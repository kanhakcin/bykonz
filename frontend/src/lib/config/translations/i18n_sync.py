#!/usr/bin/env python3
"""
i18n Translation Sync Script
Synchronizes keys across translation files using pt.json as the base source of truth.
- Adds missing keys to en.json/es.json (placeholder value)
- Removes keys from en.json/es.json that are not in pt.json

Usage:
    python3 src/config/translations/i18n_sync.py
    python3 src/config/translations/i18n_sync.py --dry-run
"""

import json
from pathlib import Path
from typing import Dict, Set
import argparse
import copy

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR / "../../../../"
TRANSLATIONS_DIR = PROJECT_ROOT / "src/lib/config/translations"

BASE_FILE = "pt.json"
TARGET_FILES = ["en.json", "es.json"]


def load_json(filename: str) -> Dict[str, str]:
    path = TRANSLATIONS_DIR / filename
    if not path.exists():
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(filename: str, data: Dict[str, str], dry_run: bool = False):
    path = TRANSLATIONS_DIR / filename
    # Sort keys: Length first, then Alphabetical
    sorted_keys = sorted(data.keys(), key=lambda k: (len(k), k.lower()))
    sorted_data = {k: data[k] for k in sorted_keys}
    
    if dry_run:
        print(f"    🔍 [DRY RUN] Would save {filename} with {len(sorted_data)} keys")
    else:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(sorted_data, f, ensure_ascii=False, indent=2)
        print(f"    ✅ Saved {filename}")


def sync_file(base_keys: Set[str], target_filename: str, dry_run: bool = False):
    print(f"  📝 Syncing {target_filename}...")
    
    target_data = load_json(target_filename)
    if not target_data:
        print(f"    ⚠️  {target_filename} not found or empty.")
        target_data = {}

    original_count = len(target_data)
    
    # 1. Remove keys not in base
    keys_to_remove = [k for k in target_data.keys() if k not in base_keys]
    for k in keys_to_remove:
        del target_data[k]
        
    # 2. Add missing keys
    keys_to_add = [k for k in base_keys if k not in target_data]
    for k in keys_to_add:
        # We don't have the translation, so we mark it or leave empty?
        # User didn't specify. To avoid breaking app, maybe use the key itself or empty string.
        # Let's use "[MISSING]" prefix for visibility, or just the key.
        # Actually safer to just put empty string or "TODO".
        # Let's use "TODO" to make it searchable.
        target_data[k] = "TODO" 
        
    print(f"    • Original keys: {original_count}")
    print(f"    • Removed: {len(keys_to_remove)}")
    print(f"    • Added: {len(keys_to_add)}")
    print(f"    • Final keys: {len(target_data)}")
    
    if len(keys_to_remove) > 0 or len(keys_to_add) > 0:
        save_json(target_filename, target_data, dry_run)
    else:
        print(f"    ✅ Already in sync.")


def main():
    parser = argparse.ArgumentParser(description='Sync i18n keys from pt.json to others')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes')
    args = parser.parse_args()
    
    print("🚀 Starting i18n synchronization (Base: pt.json)...\n")
    
    base_data = load_json(BASE_FILE)
    if not base_data:
        print(f"❌ Error: {BASE_FILE} not found!")
        return
        
    base_keys = set(base_data.keys())
    print(f"📚 {BASE_FILE} has {len(base_keys)} keys")
    
    for target in TARGET_FILES:
        sync_file(base_keys, target, args.dry_run)
        
    print("\n✨ Sync complete!")


if __name__ == "__main__":
    main()
