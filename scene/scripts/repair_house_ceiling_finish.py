"""Compatibility entry point: retain the cellar original timber slab finish."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("restore_cellar_ceiling_finish.py")),run_name="__main__")
