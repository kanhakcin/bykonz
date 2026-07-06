#!/usr/bin/env python3
"""
i18n Master Pipeline Script
Executes the full internationalization maintenance workflow in sequence.

Sequence:
1. Sort Keys (i18n_sort.py)
2. Remove Unused Keys (i18n_remove_unused.py)
3. Deduplicate Keys (i18n_deduplicate.py) [Base: pt.json]
4. Sync Keys (i18n_sync.py) [Propagate pt.json -> en/es]
5. Check Missing Keys (i18n_check_missing.py) [Generate Report]

Usage:
    python3 src/config/translations/i18n_pipeline.py
    python3 src/config/translations/i18n_pipeline.py --dry-run
"""

import subprocess
import sys
from pathlib import Path
import argparse

# Configuration
SCRIPT_DIR = Path(__file__).parent
PYTHON_EXEC = sys.executable

SCRIPTS = [
    ("i18n_sort.py", "Sorting translation files"),
    ("i18n_remove_unused.py", "Removing unused keys"),
    ("i18n_deduplicate.py", "Deduplicating keys (Base: pt.json)"),
    ("i18n_sync.py", "Synchronizing keys (pt -> en/es)"),
    ("i18n_check_missing.py", "Checking for missing keys"),
]


def run_step(script_name: str, description: str, dry_run: bool = False):
    script_path = SCRIPT_DIR / script_name
    if not script_path.exists():
        print(f"❌ Error: Script {script_name} not found at {script_path}")
        return False

    print(f"\n" + "=" * 60)
    print(f"🔄 STEP: {description}")
    print(f"   Running: {script_name}")
    print("=" * 60 + "\n")

    cmd = [PYTHON_EXEC, str(script_path)]
    if dry_run and script_name != "i18n_check_missing.py": 
        # check_missing usually doesn't need dry-run as it's read-only/reporting, 
        # but if it supports it, pass it. 
        # My implementation of check_missing doesn't have args, but others do.
        # sort, remove_unused, deduplicate, sync support --dry-run.
        cmd.append("--dry-run")
    
    try:
        # Stream output to console
        result = subprocess.run(cmd, check=True)
        if result.returncode == 0:
            return True
        else:
            print(f"⚠️  Step failed with return code {result.returncode}")
            return False
    except subprocess.CalledProcessError as e:
        print(f"❌ Error executing {script_name}: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Run full i18n maintenance pipeline')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying files')
    args = parser.parse_args()

    print("🚀 Starting i18n Master Pipeline...\n")
    if args.dry_run:
        print("🔍 DRY RUN MODE ENABLED\n")

    for script_name, description in SCRIPTS:
        success = run_step(script_name, description, args.dry_run)
        if not success:
            print(f"\n⛔ Pipeline stopped due to error in {script_name}")
            sys.exit(1)

    print("\n" + "=" * 60)
    print("✨ Pipeline completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
