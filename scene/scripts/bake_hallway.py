"""Bake the hallway using the shared surface-lighting pipeline."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('bake_room.py')),init_globals={'ROOM':'hallway'})
