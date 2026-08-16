"""
Master Notebook Executor & Populator.
Executes all 13 Data Science & Machine Learning notebooks from start to finish
using the project's virtual environment, real data, and production artifacts.
Embeds real stdout outputs, pandas HTML/text tables, and matplotlib/seaborn charts directly into .ipynb files.
"""
import os
import sys
import time
import shutil
import nbformat
from nbclient import NotebookClient

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NOTEBOOKS_DIR = os.path.join(PROJECT_ROOT, "notebooks")

notebook_files = sorted([f for f in os.listdir(NOTEBOOKS_DIR) if f.endswith(".ipynb")])

print(f"==================================================")
print(f"Executing and Populating Outputs for {len(notebook_files)} Notebooks")
print(f"==================================================\n")

results = []

for nb_file in notebook_files:
    nb_path = os.path.join(NOTEBOOKS_DIR, nb_file)
    
    print(f"▶ Executing {nb_file}...")
    start_time = time.time()
    
    try:
        with open(nb_path, "r", encoding="utf-8") as f:
            nb = nbformat.read(f, as_version=4)
        
        # Ensure cell IDs are valid for nbformat 5+
        nbformat.validator.normalize(nb)
        
        # Execute notebook with 10-minute timeout per cell
        client = NotebookClient(nb, timeout=600, kernel_name="python3")
        executed_nb = client.execute()
        
        elapsed = time.time() - start_time
        
        # Count outputs and charts
        code_cells = [c for c in executed_nb.cells if c.cell_type == "code"]
        total_outputs = sum(len(c.get("outputs", [])) for c in code_cells)
        chart_count = 0
        table_count = 0
        
        for c in code_cells:
            for o in c.get("outputs", []):
                if o.get("output_type") == "display_data" and "image/png" in o.get("data", {}):
                    chart_count += 1
                elif o.get("output_type") == "execute_result" and "text/html" in o.get("data", {}):
                    table_count += 1

        # Save populated notebook directly to notebooks/
        with open(nb_path, "w", encoding="utf-8") as f:
            nbformat.write(executed_nb, f)
            
        print(f"  ✅ Finished in {elapsed:.2f}s | Code Cells: {len(code_cells)} | Outputs: {total_outputs} | Charts: {chart_count} | Tables: {table_count}\n")
        
        results.append({
            "notebook": nb_file,
            "status": "Success",
            "time_seconds": round(elapsed, 2),
            "code_cells": len(code_cells),
            "total_outputs": total_outputs,
            "charts": chart_count,
            "tables": table_count
        })
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"  ❌ FAILED after {elapsed:.2f}s:")
        print(f"     Error: {e}\n")
        results.append({
            "notebook": nb_file,
            "status": f"Failed: {str(e)[:100]}",
            "time_seconds": round(elapsed, 2),
            "code_cells": 0,
            "total_outputs": 0,
            "charts": 0,
            "tables": 0
        })

print("==================================================")
print("EXECUTION SUMMARY REPORT")
print("==================================================")
success_count = sum(1 for r in results if r["status"] == "Success")
print(f"Total Notebooks: {len(results)} | Succeeded: {success_count} | Failed: {len(results) - success_count}\n")

print(f"{'Notebook':<45} | {'Status':<10} | {'Time (s)':<8} | {'Outputs':<8} | {'Charts':<6} | {'Tables':<6}")
print("-" * 95)
for r in results:
    print(f"{r['notebook']:<45} | {r['status']:<10} | {r['time_seconds']:<8.2f} | {r['total_outputs']:<8} | {r['charts']:<6} | {r['tables']:<6}")
