
import sys
import pytest

if __name__ == "__main__":
    with open("test_full_output.log", "w") as f:
        sys.stdout = f
        sys.stderr = f
        print("Running tests programmatically...")
        sys.path.append(".")
        ret = pytest.main(["-v", "tests/test_api_flow.py", "-s"])
        print(f"Pytest exited with code: {ret}")
        sys.exit(ret)
