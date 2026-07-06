#!/usr/bin/env python3
"""
i18n Translation Deduplication Script
Removes duplicate translation keys from pt.json and updates code references.
Uses pt.json as the source of truth.

Safety: Only removes a key from JSON if ALL code references were successfully replaced.
Preserves en/es translations: migrates existing translations to the official key.

Usage:
    python3 src/config/translations/i18n_deduplicate.py              # Run full deduplication
    python3 src/config/translations/i18n_deduplicate.py --dry-run    # Preview changes
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict
import argparse

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR / "../../../../"
TRANSLATIONS_DIR = PROJECT_ROOT / "src/lib/config/translations"
SRC_DIR = PROJECT_ROOT / "src"
REFACTOR_MAP_FILE = PROJECT_ROOT / "mapa_refatoracao.json"
REPLACEMENT_LOG_FILE = PROJECT_ROOT / "refactoring_log.txt"

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}

# Direct patterns for code replacement (use {key} placeholder)
TRANSLATION_PATTERNS = [
    r"t\(['\"]({key})['\"]\)",           # t('key')
    r"\$t\(['\"]({key})['\"]\)",         # $t('key')
    r"i18n\.t\(['\"]({key})['\"]\)",     # i18n.t('key')
]

# Indirect patterns for detecting key usage (use {key} placeholder)
INDIRECT_PATTERNS = [
    r"labelKey['\"]?:\s*['\"]({key})['\"]",      # labelKey: 'key'
    r"title:\s*['\"]({key})['\"]",                # title: 'key' (route staticData)
]

# -------------------------------------------------------------
# DYNAMIC PREFIX DETECTION
# -------------------------------------------------------------
def get_protected_sources() -> Tuple[Set[str], Set[str]]:
    """Capture both dynamic prefixes and kebab-case sources from code"""
    prefixes = set()
    kebab_sources = set()
    
    # Matches dynamic prefixes: `prefix.${...}`
    DYNAMIC_PREFIX_PATTERN = r"(?:['\"`])([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.)\$\{"
    # Matches concatenation prefixes: t('prefix.' + 
    CONCAT_PREFIX_PATTERN = r"(?:['\"`])([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.)(?:['\"`])\s*\+"
    # Matches simple kebab-case strings
    KEBAB_PATTERN = r"(?:['\"`])([a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+)(?:['\"`])"

    for ext in CODE_EXTENSIONS:
        for file_path in SRC_DIR.rglob(f"*{ext}"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract dynamic/concat prefixes
                for match in re.finditer(DYNAMIC_PREFIX_PATTERN, content):
                    prefixes.add(match.group(1))
                for match in re.finditer(CONCAT_PREFIX_PATTERN, content):
                    prefixes.add(match.group(1))
                
                # Extract kebab sources
                for match in re.finditer(KEBAB_PATTERN, content):
                    kebab_sources.add(match.group(1).replace('-', '.'))
            except Exception: pass
            
    # Add manual safety for known crucial keys
    kebab_sources.add('consumption')
    kebab_sources.add('user.type')
    kebab_sources.add('filled.form.cmms')
    kebab_sources.add('consume')

    return prefixes, kebab_sources


def find_key_in_code(key: str) -> int:
    """Count how many times a translation key appears in code files (direct + indirect)."""
    escaped_key = re.escape(key)
    count = 0
    all_patterns = TRANSLATION_PATTERNS + INDIRECT_PATTERNS
    for ext in CODE_EXTENSIONS:
        for file_path in SRC_DIR.rglob(f"*{ext}"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                for pattern_tmpl in all_patterns:
                    pattern = pattern_tmpl.replace("{key}", escaped_key)
                    count += len(re.findall(pattern, content))
            except Exception:
                pass
    return count


def analyze_duplicates() -> Dict[str, str]:
    """
    Analyze pt.json to find keys with identical values.
    Returns: { duplicate_key: official_key }
    """
    pt_file = TRANSLATIONS_DIR / "pt.json"
    print(f"  📖 Reading {pt_file.name}...")

    with open(pt_file, 'r', encoding='utf-8') as f:
        translations = json.load(f)

    # Reverse mapping: value -> [keys]
    value_to_keys = defaultdict(list)
    for key, value in translations.items():
        value_to_keys[value].append(key)

    refactor_map = {}
    duplicate_count = 0

    TECHNICAL_KEYS = {'\\n', 'index', 'normal', 'alert', 'close'}
    
    dynamic_prefixes, kebab_sources = get_protected_sources()
    print(f"  🧠 Found {len(dynamic_prefixes)} dynamic prefixes and {len(kebab_sources)} kebab-to-dot sources to protect.")

    for value, keys in value_to_keys.items():
        # NEVER deduplicate placeholder values
        if not value or value.strip() == "" or value == "TODO":
            continue

        if len(keys) > 1:
            # Filter out technical keys and ALL keys protected by dynamic prefixes or kebab-mapping
            candidates = []
            for k in keys:
                is_prefix_protected = any(k.startswith(p) for p in dynamic_prefixes)
                is_kebab_protected = k in kebab_sources
                
                if not is_prefix_protected and not is_kebab_protected and k not in TECHNICAL_KEYS:
                    candidates.append(k)

            if not candidates:
                # All keys for this value are technical or protected? Just skip.
                continue

            # Sort keys to ensure deterministic selection (shortest key first)
            sorted_keys = sorted(candidates, key=lambda k: (len(k), k.lower()))

            official_key = sorted_keys[0]
            # All other keys (including technical ones if they happened to have this value)
            duplicates = [k for k in keys if k != official_key]

            for dup in duplicates:
                refactor_map[dup] = official_key
                duplicate_count += 1

    print(f"  ✅ Found {len(value_to_keys)} unique values in pt.json")
    print(f"  ✅ Identified {duplicate_count} duplicate keys to merge")

    return refactor_map


def refactor_code_references(refactor_map: Dict[str, str], dry_run: bool = False) -> Tuple[int, int, Set[str]]:
    """
    Replace duplicate keys in code.
    Returns: (files_modified, total_replacements, successfully_replaced_keys)
    """
    files_modified = 0
    total_replacements = 0
    replacement_log = []
    replaced_keys: Set[str] = set()

    print(f"  🔍 Scanning code files in {SRC_DIR.relative_to(PROJECT_ROOT)}...")

    for ext in CODE_EXTENSIONS:
        for file_path in SRC_DIR.rglob(f"*{ext}"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                original_content = content
                file_replacements = 0

                for duplicate_key, official_key in refactor_map.items():
                    # Escape for regex
                    escaped_dup = re.escape(duplicate_key)

                    for pattern_tmpl in TRANSLATION_PATTERNS:
                        pattern = pattern_tmpl.replace("{key}", escaped_dup)

                        matches = list(re.finditer(pattern, content))
                        for match in matches:
                            original_call = match.group(0)

                            # Determine replacement string
                            quote = "'" if "'" in original_call else '"'

                            if '$t' in original_call:
                                replacement = f"$t({quote}{official_key}{quote})"
                            elif 'i18n.t' in original_call:
                                replacement = f"i18n.t({quote}{official_key}{quote})"
                            else:
                                replacement = f"t({quote}{official_key}{quote})"

                            content = content.replace(original_call, replacement, 1)
                            file_replacements += 1
                            replaced_keys.add(duplicate_key)

                            replacement_log.append(
                                f"{file_path.relative_to(PROJECT_ROOT)}: {original_call} -> {replacement}"
                            )

                if content != original_content:
                    files_modified += 1
                    total_replacements += file_replacements
                    if not dry_run:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)

            except Exception as e:
                print(f"    ⚠️  Error processing {file_path}: {e}")

    if replacement_log and not dry_run:
        with open(REPLACEMENT_LOG_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(replacement_log))

    return files_modified, total_replacements, replaced_keys


def get_safe_removals(refactor_map: Dict[str, str], replaced_keys: Set[str]) -> Tuple[Set[str], Set[str]]:
    """
    Determine which keys are safe to remove.
    A key is safe to remove if:
      - It was found and replaced in code (replaced_keys), OR
      - It was never used in code at all (no references found)

    Returns: (safe_to_remove, unsafe_keys)
    """
    safe_to_remove: Set[str] = set()
    unsafe_keys: Set[str] = set()

    for dup_key in refactor_map:
        if dup_key in replaced_keys:
            # Code was successfully updated
            safe_to_remove.add(dup_key)
        else:
            # Key was not found in code by replacement - check if it's really unused
            usages = find_key_in_code(dup_key)
            if usages == 0:
                # Key exists in JSON but not in code - safe to remove from JSON
                safe_to_remove.add(dup_key)
            else:
                # Key is in code but our replacement didn't catch it - NOT safe
                unsafe_keys.add(dup_key)

    return safe_to_remove, unsafe_keys


def migrate_translations(refactor_map: Dict[str, str], safe_to_remove: Set[str], dry_run: bool = False) -> None:
    """
    Before removing duplicate keys, migrate their en/es translations to the official key.
    If the official key has "TODO" but the duplicate has a real translation, keep the real one.
    """
    for lang_file in ["en.json", "es.json"]:
        file_path = TRANSLATIONS_DIR / lang_file
        if not file_path.exists():
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            translations = json.load(f)

        modified = False
        migrations = 0

        for dup_key in safe_to_remove:
            official_key = refactor_map[dup_key]
            dup_value = translations.get(dup_key, "")
            official_value = translations.get(official_key, "")

            # Migrate if official has no real translation but duplicate does
            if dup_value and dup_value != "TODO" and (not official_value or official_value == "TODO"):
                translations[official_key] = dup_value
                modified = True
                migrations += 1

            # Remove the duplicate key
            if dup_key in translations:
                del translations[dup_key]
                modified = True

        if modified:
            if not dry_run:
                sorted_keys = sorted(translations.keys(), key=lambda k: (len(k), k.lower()))
                sorted_translations = {k: translations[k] for k in sorted_keys}
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(sorted_translations, f, ensure_ascii=False, indent=2)
                print(f"    ✅ {lang_file}: migrated {migrations} translations, removed {len([k for k in safe_to_remove if k in translations or True])} duplicate keys")
            else:
                print(f"    🔍 [DRY RUN] {lang_file}: would migrate {migrations} translations")


def clean_json_files(refactor_map: Dict[str, str], safe_to_remove: Set[str], dry_run: bool = False) -> None:
    """Remove duplicate keys from pt.json (only safe ones)"""
    pt_file = TRANSLATIONS_DIR / "pt.json"

    print(f"  📝 Processing {pt_file.name}...")

    with open(pt_file, 'r', encoding='utf-8') as f:
        translations = json.load(f)

    original_count = len(translations)

    # Remove only safe duplicates
    keys_removed = 0
    for key in safe_to_remove:
        if key in translations:
            del translations[key]
            keys_removed += 1

    # Sort (maintain order)
    sorted_keys = sorted(translations.keys(), key=lambda k: (len(k), k.lower()))
    sorted_translations = {k: translations[k] for k in sorted_keys}

    final_count = len(sorted_translations)

    print(f"    • Original keys: {original_count}")
    print(f"    • Removed: {keys_removed}")
    print(f"    • Final keys: {final_count}")

    if not dry_run:
        with open(pt_file, 'w', encoding='utf-8') as f:
            json.dump(sorted_translations, f, ensure_ascii=False, indent=2)
        print(f"    ✅ Saved {pt_file.name}")
    else:
        print(f"    🔍 [DRY RUN] Would save {pt_file.name}")


def main():
    parser = argparse.ArgumentParser(description='Deduplicate i18n keys based on pt.json')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes')
    args = parser.parse_args()

    print("🚀 Starting i18n deduplication (Master: pt.json)...\n")

    # 1. Analyze
    refactor_map = analyze_duplicates()
    if not refactor_map:
        print("\n✨ No duplicates found in pt.json.")
        return

    # 2. Refactor Code FIRST (before removing keys from JSON)
    print("\n🔧 Refactoring code references...")
    files, replacements, replaced_keys = refactor_code_references(refactor_map, args.dry_run)

    print(f"\n  ✅ Modified {files} files")
    print(f"  ✅ Made {replacements} replacements")

    # 3. Determine which keys are safe to remove
    print("\n🔒 Verifying safe removals...")
    safe_to_remove, unsafe_keys = get_safe_removals(refactor_map, replaced_keys)

    print(f"  ✅ {len(safe_to_remove)} keys safe to remove")
    if unsafe_keys:
        print(f"  ⚠️  {len(unsafe_keys)} keys SKIPPED (still referenced in code but not replaced):")
        for key in sorted(unsafe_keys):
            print(f"    • {key} -> {refactor_map[key]}")

    if not safe_to_remove:
        print("\n⚠️  No keys safe to remove. Check the warnings above.")
        return

    # 4. Migrate en/es translations before removing
    print("\n🔄 Migrating en/es translations...")
    migrate_translations(refactor_map, safe_to_remove, args.dry_run)

    # 5. Clean pt.json (only safe keys)
    print("\n🧹 Cleaning pt.json...")
    clean_json_files(refactor_map, safe_to_remove, args.dry_run)

    # 6. Save refactor map
    if not args.dry_run:
        safe_map = {k: v for k, v in refactor_map.items() if k in safe_to_remove}
        with open(REFACTOR_MAP_FILE, 'w', encoding='utf-8') as f:
            json.dump(safe_map, f, ensure_ascii=False, indent=2)

    if args.dry_run:
        print("\n🔍 DRY RUN COMPLETE")
    else:
        print("\n✨ Deduplication complete!")


if __name__ == "__main__":
    main()
