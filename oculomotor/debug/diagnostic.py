"""
================================================================================
 Diagnostic CLI — one entry point for all debug tools.

 Usage:
   python -m oculomotor.debug.diagnostic math       # pure-logic tests
   python -m oculomotor.debug.diagnostic iris       # live iris viewer
   python -m oculomotor.debug.diagnostic trace      # scripted look-L/R harness
================================================================================
"""

import sys


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1].lower()
    if cmd == "math":
        from . import synthetic_tests
        synthetic_tests.main()
    elif cmd == "iris":
        from . import iris_visualizer
        iris_visualizer.run()
    elif cmd == "trace":
        from . import trial_trace
        trial_trace.run()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()