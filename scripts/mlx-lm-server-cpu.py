#!/usr/bin/env python3
"""Start mlx-lm's OpenAI-compatible server with CPU as the default device.

mlx_lm.server does not expose a device CLI option. The default device must be
selected before importing the server because mlx-lm creates generation streams
at import time.
"""

import mlx.core as mx

mx.set_default_device(mx.cpu)

from mlx_lm.server import main  # noqa: E402


if __name__ == "__main__":
    if mx.default_device() != mx.cpu:
        raise SystemExit("Refusing to start: MLX did not select the CPU device")
    main()
