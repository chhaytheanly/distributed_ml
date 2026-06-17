#!/usr/bin/env python3
"""
Local development entry point.
For Docker deployment, use: docker compose --profile job up spark-submit
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from run_pipeline import main

if __name__ == "__main__":
    main()
