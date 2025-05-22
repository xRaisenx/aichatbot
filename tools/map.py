import os
from datetime import datetime

def beautify_time(timestamp):
    """Convert a timestamp to human-readable format."""
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

def generate_tree(path='.', prefix='', depth=0):
    tree = []
    items = sorted(os.listdir(path))

    for index, name in enumerate(items):
        # Skip files or folders starting with a period (hidden files)
        if name.startswith('.') or name == 'node_modules':
            continue

        full_path = os.path.join(path, name)
        relative_path = os.path.relpath(full_path)
        is_last = index == len(items) - 1
        connector = '└── ' if is_last else '├── '
        display_line = f"{prefix}{connector}{name}"
        tree.append(display_line)

        # Logging
        if os.path.isdir(full_path):
            print(f"[DIR ]  {relative_path} | Last modified: {beautify_time(os.path.getmtime(full_path))}")
            extension = '    ' if is_last else '│   '
            tree.extend(generate_tree(full_path, prefix + extension, depth + 1))
        else:
            print(f"[FILE]  {relative_path} | Last modified: {beautify_time(os.path.getmtime(full_path))}")
    
    return tree

if __name__ == '__main__':
    print("\n📁 Starting file tree generation...\n")
    tree_output = generate_tree()

    md_path = os.path.join('.', 'treeview.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("# 📂 File Tree View\n\n")
        f.write("```\n")
        f.write('\n'.join(tree_output))
        f.write("\n```")

    print(f"\n✅ Tree view saved to: {md_path}")
