#!/usr/bin/env python3
"""
i18n Translation Validation Script
Validates the results of the deduplication process

Usage:
    python3 src/config/translations/i18n_validate.py
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR / "../../../../"
TRANSLATIONS_DIR = PROJECT_ROOT / "src/lib/config/translations"
SRC_DIR = PROJECT_ROOT / "src"
REFACTOR_MAP_FILE = PROJECT_ROOT / "mapa_refatoracao.json"

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}


def check_no_duplicates() -> bool:
    """Verify no duplicate values remain in pt.json (ignoring protected)"""
    print("🔍 Checking for remaining duplicates in pt.json...")
    
    pt_file = TRANSLATIONS_DIR / "pt.json"
    with open(pt_file, 'r', encoding='utf-8') as f:
        translations = json.load(f)
    
    # Create reverse mapping
    value_to_keys = defaultdict(list)
    for key, value in translations.items():
        value_to_keys[value].append(key)
    
    # Extract dynamic prefixes
    dynamic_prefixes = set()
    DYNAMIC_PREFIX_PATTERN = r"(?:['\"`])([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.)\$\{"
    for ext in CODE_EXTENSIONS:
        for file_path in SRC_DIR.rglob(f"*{ext}"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                for match in re.finditer(DYNAMIC_PREFIX_PATTERN, content):
                    dynamic_prefixes.add(match.group(1))
            except Exception: pass
            
    TECHNICAL_KEYS = {'\\n', 'index', 'normal', 'alert', 'close'}
    
    # Find duplicates
    real_duplicates = {}
    for value, keys in value_to_keys.items():
        if len(keys) > 1 and value.strip() != "" and value != "TODO":
            unprotected_keys = [k for k in keys if k not in TECHNICAL_KEYS and not any(k.startswith(p) for p in dynamic_prefixes)]
            if len(unprotected_keys) > 1:
                real_duplicates[value] = unprotected_keys
    
    if real_duplicates:
        print(f"  ❌ Found {len(real_duplicates)} duplicate values (excluding protected):")
        for value, keys in list(real_duplicates.items())[:5]:  # Show first 5
            print(f"    • '{value}' → {keys}")
        if len(real_duplicates) > 5:
            print(f"    ... and {len(real_duplicates) - 5} more")
        return False
    else:
        print(f"  ✅ No unprotected duplicates found!")
        return True


def check_removed_keys() -> bool:
    """Check that all duplicate keys were removed from translation files"""
    print("\n🔍 Checking that duplicate keys were removed...")
    
    if not REFACTOR_MAP_FILE.exists():
        print("  ⚠️  mapa_refatoracao.json not found, skipping check")
        return True
    
    with open(REFACTOR_MAP_FILE, 'r', encoding='utf-8') as f:
        refactor_map = json.load(f)
    
    duplicate_keys = set(refactor_map.keys())
    all_removed = True
    
    for lang_file in ["pt.json", "en.json", "es.json"]:
        file_path = TRANSLATIONS_DIR / lang_file
        if not file_path.exists():
            continue
        
        with open(file_path, 'r', encoding='utf-8') as f:
            translations = json.load(f)
        
        remaining = duplicate_keys & set(translations.keys())
        
        if remaining:
            print(f"  ❌ {lang_file}: {len(remaining)} duplicate keys still present")
            for key in list(remaining)[:3]:
                print(f"    • {key}")
            all_removed = False
        else:
            print(f"  ✅ {lang_file}: All duplicate keys removed")
    
    return all_removed


def is_valid_translation_key(key: str) -> bool:
    """Check if a string looks like a valid translation key"""
    if not key or len(key) < 2:
        return False
    if key.startswith(('http://', 'https://', '../', './', '/')):
        return False
    if ' ' in key:
        return False
    if key.endswith(('.js', '.ts', '.tsx', '.jsx', '.css', '.json')):
        return False
    return True


def check_broken_references() -> bool:
    """Check for broken translation key references in code"""
    print("\n🔍 Checking for broken translation references...")

    # Load all valid keys from pt.json
    pt_file = TRANSLATIONS_DIR / "pt.json"
    with open(pt_file, 'r', encoding='utf-8') as f:
        valid_keys = set(json.load(f).keys())

    # Direct patterns
    patterns = [
        r"(?<!\w)t\(['\"]([^'\"]+)['\"]\)",
        r"\$t\(['\"]([^'\"]+)['\"]\)",
        r"i18n\.t\(['\"]([^'\"]+)['\"]\)",
        r"labelKey['\"]?:\s*['\"]([^'\"]+)['\"]",
        r"title:\s*['\"]([a-z][a-z0-9]*(?:\.[a-z0-9.-]+)+)['\"]",
    ]
    broken_refs = []
    files_checked = 0

    # Scan code files
    for ext in CODE_EXTENSIONS:
        for file_path in SRC_DIR.rglob(f"*{ext}"):
            files_checked += 1
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Find all translation keys used in this file
                for pattern in patterns:
                    matches = re.finditer(pattern, content)
                    for match in matches:
                        key = match.group(1)
                        if is_valid_translation_key(key) and key not in valid_keys:
                            broken_refs.append({
                                'file': file_path.relative_to(PROJECT_ROOT),
                                'key': key,
                                'line': content[:match.start()].count('\n') + 1
                            })
            except Exception:
                pass  # Skip files that can't be read
    
    print(f"  📊 Scanned {files_checked} code files")
    
    if broken_refs:
        print(f"  ❌ Found {len(broken_refs)} broken references:")
        for ref in broken_refs[:10]:  # Show first 10
            print(f"    • {ref['file']}:{ref['line']} → '{ref['key']}'")
        if len(broken_refs) > 10:
            print(f"    ... and {len(broken_refs) - 10} more")
        return False
    else:
        print(f"  ✅ No broken references found!")
        return True


def check_refactor_map_consistency() -> bool:
    """Verify refactor map is consistent"""
    print("\n🔍 Checking refactor map consistency...")
    
    if not REFACTOR_MAP_FILE.exists():
        print("  ⚠️  mapa_refatoracao.json not found, skipping check")
        return True
    
    with open(REFACTOR_MAP_FILE, 'r', encoding='utf-8') as f:
        refactor_map = json.load(f)
    
    # Load pt.json to verify official keys exist
    pt_file = TRANSLATIONS_DIR / "pt.json"
    with open(pt_file, 'r', encoding='utf-8') as f:
        translations = json.load(f)
    
    issues = []
    
    for duplicate_key, official_key in refactor_map.items():
        # Check official key exists
        if official_key not in translations:
            issues.append(f"Official key '{official_key}' not found in pt.json")
        
        # Check duplicate key doesn't exist (should be removed)
        if duplicate_key in translations:
            issues.append(f"Duplicate key '{duplicate_key}' still exists in pt.json")
    
    if issues:
        print(f"  ❌ Found {len(issues)} consistency issues:")
        for issue in issues[:5]:
            print(f"    • {issue}")
        return False
    else:
        print(f"  ✅ Refactor map is consistent ({len(refactor_map)} mappings)")
        return True


def main():
    print("🔍 i18n Translation Validation\n")
    print("=" * 60)
    
    results = {
        "No duplicates": check_no_duplicates(),
        "Duplicate keys removed": check_removed_keys(),
        "No broken references": check_broken_references(),
        "Refactor map consistent": check_refactor_map_consistency(),
    }
    
    print("\n" + "=" * 60)
    print("📊 Validation Summary:\n")
    
    all_passed = True
    for check, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} - {check}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    
    if all_passed:
        print("✨ All validation checks passed!")
        print("\n✅ Your i18n files are clean and consistent")
        return 0
    else:
        print("⚠️  Some validation checks failed")
        print("\n🔧 Please review the issues above and fix them")
        return 1


if __name__ == "__main__":
    exit(main())
