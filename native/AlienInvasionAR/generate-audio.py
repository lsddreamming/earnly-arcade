#!/usr/bin/env python3
"""Compatibility entry point for the shared offline sound bank."""
import sys
from audio_assets import write_sounds as generate
if __name__ == '__main__': generate(sys.argv[1], sys.argv[2] if len(sys.argv)>2 else '')
