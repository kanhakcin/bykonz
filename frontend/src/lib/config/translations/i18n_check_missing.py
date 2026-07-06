#!/usr/bin/env python3
"""
i18n Missing Keys Checker
Finds translation keys used in code that don't exist in pt.json.
Generates a report file "missing_translations_keys.txt".
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR / "../../../../"
TRANSLATIONS_DIR = PROJECT_ROOT / "src/lib/config/translations"
SRC_DIR = PROJECT_ROOT / "src"
REPORT_FILE = PROJECT_ROOT / "missing_translations_keys.txt"

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}

# Simple string literals, e.g., 'foo.bar'
STRING_LITERAL_PATTERN = r"(?:['\"`])([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)(?:['\"`])"

# Exclude technical or simple strings that aren't translation keys
def is_valid_translation_key(key: str) -> bool:
    if not key or len(key) < 2:
        return False
    # No spaces
    if ' ' in key:
        return False
    # Only alphanumeric, dot, dash, underscore
    if not re.match(r"^[a-zA-Z0-9_.-]+$", key):
        return False
    # Must have at least one dot to be a typical key? Wait, some keys are just "alert"
    # But to reduce false positives in check_missing, we might require dots or specifically
    # only report matches inside a translation function to avoid massive noise.
    
    # Actually, check_missing is meant to find keys used in code that don't exist in pt.json.
    # If we just extract ALL literal strings, the noise will be immense for missing keys.
    # We should ONLY check direct translation patterns for missing keys to be safe.
    
DIRECT_TRANSLATION_PATTERNS = [
    r"(?<!\w)t\(['\"]([^'\"]+)['\"]\)",
    r"\$t\(['\"]([^'\"]+)['\"]\)",
    r"i18n\.t\(['\"]([^'\"]+)['\"]\)",
    r"labelKey['\"]?:\s*['\"]([^'\"]+)['\"]",
    r"title:\s*['\"]([a-z][a-z0-9]*(?:\.[a-z0-9.-]+)+)['\"]",
]


def is_valid_translation_key(key: str) -> bool:
    """Check if a string looks like a valid translation key"""
    if not key or len(key) < 2:
        return False
    # Filter out URLs, file paths, and technical strings
    if key.startswith(('http://', 'https://', '../', './', '/')):
        return False
    # Filter out strings with spaces (translation keys use dots/dashes, not spaces)
    if ' ' in key:
        return False
    # Filter out strings that look like file extensions or imports
    if key.endswith(('.js', '.ts', '.tsx', '.jsx', '.css', '.json')):
        return False
    return True


def check_missing_keys():
    print("🔍 Checking for missing translation keys...\n")
    
    # Load valid keys
    pt_file = TRANSLATIONS_DIR / "pt.json"
    if not pt_file.exists():
        print("❌ pt.json not found!")
        return

    with open(pt_file, 'r', encoding='utf-8') as f:
        valid_keys = set(json.load(f).keys())
    
    print(f"📚 Loaded {len(valid_keys)} valid keys from pt.json")

    missing_occurrences = defaultdict(list)
    files_checked = 0

    # Scan code
    for ext in CODE_EXTENSIONS:
        for file_path in SRC_DIR.rglob(f"*{ext}"):
            files_checked += 1
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Find occurrences using translation patterns
                all_patterns = DIRECT_TRANSLATION_PATTERNS
                for pattern in all_patterns:
                    matches = list(re.finditer(pattern, content))
                    for match in matches:
                        key = match.group(1)
                        if key not in valid_keys and is_valid_translation_key(key):
                            line = content[:match.start()].count('\n') + 1
                            missing_occurrences[key].append(
                                f"{file_path.relative_to(PROJECT_ROOT)}:{line}"
                            )
            except Exception:
                pass

    print(f"📊 Scanned {files_checked} code files")
    
    # Generate Report
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("RELATÓRIO DE CHAVES DE TRADUÇÃO FALTANDO\n")
        f.write(f"Base de comparação: pt.json\n")
        f.write("=" * 60 + "\n\n")
        
        if not missing_occurrences:
            f.write("✅ Nenhuma chave faltando! Tudo sincronizado.\n")
            print("\n✨ No missing keys found!")
        else:
            f.write(f"Total de chaves faltando: {len(missing_occurrences)}\n\n")
            
            # Sort by number of occurrences
            sorted_missing = sorted(missing_occurrences.items(), key=lambda x: len(x[1]), reverse=True)
            
            for key, locs in sorted_missing:
                f.write(f"🔑 '{key}' ({len(locs)} usos)\n")
                for loc in locs[:5]: # Cap at 5 examples per key in file to avoid huge files
                    f.write(f"   └─ {loc}\n")
                if len(locs) > 5:
                    f.write(f"   └─ ... e mais {len(locs)-5}\n")
                f.write("\n")
            
            print(f"\n❌ Found {len(missing_occurrences)} missing keys.")
            print(f"📄 Report saved to: {REPORT_FILE.name}")


if __name__ == "__main__":
    check_missing_keys()
