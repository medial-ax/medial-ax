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
    dict = defaultdict(int)

    def __init__(self, label: str):
        self.label = label

    def __enter__(self):
        self.start = perf_counter_ns()

    def __exit__(self, _, _1, _2):
        end = perf_counter_ns()
        Timed.dict[self.label] += end - self.start

    def report():
        maxlen = max([len(s) for s in Timed.dict.keys()])
        print("|======== Timed report ========")
        for k, v in Timed.dict.items():
            print(f"| {k: >{maxlen}}: {v / 1e6:10.2f}ms")
        print("|==============================")
