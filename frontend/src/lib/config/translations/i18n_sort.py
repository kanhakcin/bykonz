#!/usr/bin/env python3
"""
i18n Translation Sorting Script
Organizes translation keys by length (shortest first) and then alphabetically.

Usage:
    python3 src/config/translations/i18n_sort.py              # Sort all translation files
    python3 src/config/translations/i18n_sort.py --dry-run    # Preview changes without modifying files
"""

import json
from pathlib import Path
from typing import Dict, List
import argparse

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR / "../../../../"
TRANSLATIONS_DIR = PROJECT_ROOT / "src/lib/config/translations"

TRANSLATION_FILES = ["pt.json", "en.json", "es.json"]


def sort_translations(file_path: Path, dry_run: bool = False) -> bool:
    """Sort translation keys by length and then alphabetically"""
    if not file_path.exists():
        print(f"  ⚠️  {file_path.name} not found, skipping...")
        return False

    print(f"  📝 Processing {file_path.name}...")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            translations = json.load(f)

        if not isinstance(translations, dict):
            print(f"  ❌ Error: {file_path.name} does not contain a JSON object.")
            return False

        # Get keys and sort them: primary by length, secondary alphabetically
        original_keys = list(translations.keys())
        sorted_keys = sorted(original_keys, key=lambda k: (len(k), k.lower()))

        # Check if already sorted
        if original_keys == sorted_keys:
            print(f"    ✅ Already sorted!")
            return True

        # Create new dict with sorted keys
        sorted_translations = {key: translations[key] for key in sorted_keys}

        if not dry_run:
            # Write back with proper formatting
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(sorted_translations, f, ensure_ascii=False, indent=2)
            print(f"    ✅ Saved {file_path.name} (reordered)")
        else:
            print(f"    🔍 [DRY RUN] Would reorder {file_path.name}")
        
        return True

    except Exception as e:
        print(f"  ❌ Error processing {file_path.name}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Sort i18n translation keys by length and alphabet')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying files')
    args = parser.parse_args()

    dry_run = args.dry_run

    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified\n")

    print("🚀 Starting i18n sorting process...\n")

    success_count = 0
    for lang_file in TRANSLATION_FILES:
        file_path = TRANSLATIONS_DIR / lang_file
        if sort_translations(file_path, dry_run):
            success_count += 1

    print("\n" + "=" * 60)
    if dry_run:
        print(f"🔍 DRY RUN COMPLETE - Processed {success_count} files")
    else:
        print(f"✨ Sorting process completed! Successfully processed {success_count} files.")
    print("=" * 60)


if __name__ == "__main__":
    main()
