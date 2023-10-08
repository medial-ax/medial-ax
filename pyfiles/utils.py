from collections import defaultdict
from time import perf_counter_ns


class Time:
    label: str

    def __init__(self, label: str):
        self.label = label

    def __enter__(self):
        self.start = perf_counter_ns()

    def __exit__(self, _, _1, _2):
        end = perf_counter_ns()
        print(f"[T]{self.label}: {(end - self.start) / 1e6}ms")


class Timed:
    label: str
    times = defaultdict(int)
    count = defaultdict(int)

    def __init__(self, label: str):
        self.label = label

    def __enter__(self):
        self.start = perf_counter_ns()

    def __exit__(self, _, _1, _2):
        end = perf_counter_ns()
        Timed.times[self.label] += end - self.start
        Timed.count[self.label] += 1

    def report():
        maxlen = max([len(s) for s in Timed.times.keys()])
        print("|======== Timed report ========")
        for k, v in Timed.times.items():
            print(
                f"| {k: >{maxlen}}: {v / 1e6:10.2f}ms  ({v / 1e6 / Timed.count[k]:6.3f}ms per; #{Timed.count[k]})"
            )
        print("|==============================")
        Timed.times.clear()
        Timed.count.clear()
