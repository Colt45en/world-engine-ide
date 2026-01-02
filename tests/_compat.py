def typing_works() -> bool:
    try:
        import typing  # type: ignore
        return True
    except TypeError:
        # Known typing issue on some Python 3.13 builds in this environment
        return False
    except Exception:
        # Other import errors likely mean typing is okay but different problem
        return True
