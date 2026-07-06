#!/usr/bin/env python3
"""
Analisa o uso dos componentes UI no projeto.
Percorre src/components/ui/ e busca por usos de cada export em todo o codebase.
"""

import os
import re
from pathlib import Path
from collections import defaultdict

# Diretório raiz do projeto
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
UI_DIR = PROJECT_ROOT / "src" / "components" / "ui"
SRC_DIR = PROJECT_ROOT / "src"

# Extensões de arquivo para buscar
EXTENSIONS = {".tsx", ".ts", ".jsx", ".js"}

# Arquivos/pastas para ignorar
IGNORE_PATTERNS = {"node_modules", ".git", "dist", "build", "__tests__", ".test.", ".spec."}


def get_exports_from_file(file_path: Path) -> list[dict]:
    """Extrai todos os exports de um arquivo."""
    exports = []
    content = file_path.read_text(encoding="utf-8")

    # Export de função: export function Name ou export const Name
    func_exports = re.findall(r"export\s+(?:function|const)\s+(\w+)", content)
    for name in func_exports:
        exports.append({"name": name, "type": "function/const"})

    # Export de tipo/interface: export type Name ou export interface Name
    type_exports = re.findall(r"export\s+(?:type|interface)\s+(\w+)", content)
    for name in type_exports:
        exports.append({"name": name, "type": "type/interface"})

    # Re-exports: export { Name } from ou export { Name as Alias }
    reexports = re.findall(r"export\s*\{([^}]+)\}", content)
    for group in reexports:
        # Pega cada item separado por vírgula
        items = group.split(",")
        for item in items:
            item = item.strip()
            if " as " in item:
                # export { Original as Alias } -> pega o Alias
                name = item.split(" as ")[-1].strip()
            else:
                name = item.strip()
            if name and not name.startswith("type "):
                exports.append({"name": name, "type": "re-export"})

    return exports


def get_ui_components():
    """Coleta todos os exports de cada arquivo UI."""
    components = {}

    for file_path in UI_DIR.glob("*.tsx"):
        if file_path.name.startswith("_"):
            continue

        file_name = file_path.stem  # nome sem extensão
        exports = get_exports_from_file(file_path)

        for export in exports:
            key = f"{export['name']}"
            if key not in components:
                components[key] = {
                    "file": file_path.name,
                    "type": export["type"],
                    "usages": [],
                    "count": 0
                }

    return components


def should_ignore(path: Path) -> bool:
    """Verifica se o arquivo deve ser ignorado."""
    path_str = str(path)
    return any(pattern in path_str for pattern in IGNORE_PATTERNS)


def find_usages(components: dict):
    """Busca por usos de cada componente no codebase."""

    for file_path in SRC_DIR.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix not in EXTENSIONS:
            continue
        if should_ignore(file_path):
            continue
        # Ignora os próprios arquivos de definição
        if file_path.parent == UI_DIR:
            continue

        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        relative_path = file_path.relative_to(PROJECT_ROOT)

        for comp_name, data in components.items():
            # Busca por uso como componente JSX: <ComponentName ou </ComponentName
            # ou como função/hook: useComponent( ou ComponentName(
            # ou em imports: import { ComponentName }
            jsx_pattern = rf"<{comp_name}[\s/>]|</{comp_name}>"
            func_pattern = rf"\b{comp_name}\s*\(|\b{comp_name}\."

            jsx_matches = re.findall(jsx_pattern, content)
            func_matches = re.findall(func_pattern, content)

            # Remove matches que são da própria definição (export function X)
            total_matches = len(jsx_matches) + len(func_matches)

            if total_matches > 0:
                components[comp_name]["usages"].append({
                    "file": str(relative_path),
                    "count": total_matches
                })
                components[comp_name]["count"] += total_matches


def print_report(components: dict):
    """Imprime o relatório de uso."""

    # Filtra apenas componentes (não tipos) para o ranking principal
    all_items = [(name, data) for name, data in components.items()]

    # Ordena por contagem de uso (decrescente)
    sorted_items = sorted(all_items, key=lambda x: x[1]["count"], reverse=True)

    used = [(name, data) for name, data in sorted_items if data["count"] > 0]
    unused = [(name, data) for name, data in sorted_items if data["count"] == 0]

    # Separa tipos dos componentes
    used_components = [(n, d) for n, d in used if d["type"] != "type/interface"]
    used_types = [(n, d) for n, d in used if d["type"] == "type/interface"]
    unused_components = [(n, d) for n, d in unused if d["type"] != "type/interface"]
    unused_types = [(n, d) for n, d in unused if d["type"] == "type/interface"]

    print("=" * 70)
    print("📊 RELATÓRIO DE USO DOS COMPONENTES UI")
    print("=" * 70)

    print(f"\n📈 Total de Exports: {len(components)}")
    print(f"   • Componentes/Funções: {len(used_components) + len(unused_components)}")
    print(f"   • Types/Interfaces: {len(used_types) + len(unused_types)}")
    print(f"\n✅ Em uso: {len(used)}")
    print(f"⚠️  Sem uso: {len(unused)}")

    # Top 20 mais usados
    print("\n" + "-" * 70)
    print("🏆 TOP 20 COMPONENTES MAIS USADOS")
    print("-" * 70)

    for i, (name, data) in enumerate(used_components[:20], 1):
        print(f"{i:2}. {name:<35} {data['count']:>4} usos  ({data['file']})")

    # Componentes em uso (resumo)
    print("\n" + "-" * 70)
    print(f"✅ TODOS OS COMPONENTES EM USO ({len(used_components)})")
    print("-" * 70)

    # Agrupa por arquivo
    by_file = defaultdict(list)
    for name, data in used_components:
        by_file[data["file"]].append((name, data["count"]))

    for file_name in sorted(by_file.keys()):
        items = sorted(by_file[file_name], key=lambda x: x[1], reverse=True)
        total = sum(c for _, c in items)
        print(f"\n📁 {file_name} (total: {total} usos)")
        for name, count in items:
            print(f"   • {name:<30} ({count})")

    # Componentes não usados
    print("\n" + "-" * 70)
    print(f"⚠️  EXPORTS SEM USO ({len(unused)})")
    print("-" * 70)

    if unused_components:
        print("\n🔧 Componentes/Funções sem uso:")
        by_file = defaultdict(list)
        for name, data in unused_components:
            by_file[data["file"]].append(name)

        for file_name in sorted(by_file.keys()):
            print(f"   {file_name}: {', '.join(by_file[file_name])}")

    if unused_types:
        print("\n📝 Types/Interfaces sem uso:")
        by_file = defaultdict(list)
        for name, data in unused_types:
            by_file[data["file"]].append(name)

        for file_name in sorted(by_file.keys()):
            print(f"   {file_name}: {', '.join(by_file[file_name])}")

    # Resumo final
    print("\n" + "=" * 70)
    print("📋 RESUMO")
    print("=" * 70)
    print(f"Total exports: {len(components)}")
    print(f"Em uso: {len(used)} ({len(used)/len(components)*100:.1f}%)")
    print(f"Sem uso: {len(unused)} ({len(unused)/len(components)*100:.1f}%)")


def export_csv(components: dict):
    """Exporta os dados para CSV."""
    csv_path = UI_DIR / "ui-usage-report.csv"

    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("Export,File,Type,UsageCount,UsedInFiles\n")

        for name, data in sorted(components.items(), key=lambda x: x[1]["count"], reverse=True):
            files = "; ".join([u["file"] for u in data["usages"][:10]])
            if len(data["usages"]) > 10:
                files += f"; ... +{len(data['usages']) - 10} more"
            f.write(f"{name},{data['file']},{data['type']},{data['count']},\"{files}\"\n")

    print(f"\n📄 Relatório CSV exportado: {csv_path.relative_to(PROJECT_ROOT)}")


def main():
    print("🔍 Analisando uso dos componentes UI...\n")

    # Coleta os componentes
    components = get_ui_components()
    print(f"Encontrados {len(components)} exports em {UI_DIR.relative_to(PROJECT_ROOT)}")

    # Busca usos
    print("Buscando usos no codebase...")
    find_usages(components)

    # Imprime relatório
    print_report(components)

    # Exporta CSV
    export_csv(components)


if __name__ == "__main__":
    main()
