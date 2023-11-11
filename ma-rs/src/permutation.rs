#[derive(Debug, Clone)]
#[pyo3::pyclass]
pub struct Permutation {
    forwards: Vec<usize>,
    backwards: Vec<usize>,
}

impl Permutation {
    pub fn new(n: usize) -> Self {
        Permutation {
            forwards: (0..n).collect(),
            backwards: (0..n).collect(),
        }
    }

    pub fn map(&self, a: usize) -> usize {
        self.forwards[a]
    }

    pub fn inv(&self, a: usize) -> usize {
        self.backwards[a]
    }

    /// Apply the swap to the "end" of the permutation.
    /// ```rust
    /// # use ma_rs::Permutation;
    /// let mut p = Permutation::new(10);
    /// p.swap(2, 3);
    /// assert_eq!(p.map(0), 0);
    /// assert_eq!(p.map(1), 1);
    /// assert_eq!(p.map(2), 3);
    /// assert_eq!(p.map(3), 2);
    /// p.swap(3, 1);
    /// assert_eq!(p.map(0), 0);
    /// assert_eq!(p.map(1), 2);
    /// assert_eq!(p.map(2), 3);
    /// assert_eq!(p.map(3), 1);
    /// ```
    pub fn swap(&mut self, a: usize, b: usize) {
        self.forwards.swap(a, b);
        self.backwards.swap(self.forwards[a], self.forwards[b]);
    }

    pub fn len(&self) -> usize {
        self.forwards.len()
    }

    /// Construct a permutation from a list of tuples of `(O, usize)`, where `O` is
    /// an ordering type. The ordering type is used to sort the list of tuples.
    pub fn from_ord<O: Ord + Copy>(mut es: Vec<(O, usize)>) -> Self {
        es.sort_by_key(|&(o, _)| o);

        let forwards = es.iter().map(|&(_, i)| i).collect::<Vec<_>>();
        let mut backwards = vec![0; forwards.len()];
        for (i, &f) in forwards.iter().enumerate() {
            backwards[f] = i;
        }
        Permutation {
            forwards,
            backwards,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permutation() {
        fn test_inverse(p: &Permutation) {
            for i in 0..p.len() {
                assert_eq!(p.inv(p.map(i)), i);
                assert_eq!(p.map(p.inv(i)), i);
            }
        }

        let mut p = Permutation::new(10);

        for i in 0..p.len() {
            assert_eq!(p.map(i), i);
        }
        test_inverse(&p);

        p.swap(2, 3);

        assert_eq!(p.map(0), 0);
        assert_eq!(p.map(1), 1);
        assert_eq!(p.map(2), 3);
        assert_eq!(p.map(3), 2);

        assert_eq!(p.inv(0), 0);
        assert_eq!(p.inv(1), 1);
        assert_eq!(p.inv(2), 3);
        assert_eq!(p.inv(3), 2);
        test_inverse(&p);

        p.swap(1, 2);

        assert_eq!(p.map(0), 0);
        assert_eq!(p.map(1), 3);
        assert_eq!(p.map(2), 1);
        assert_eq!(p.map(3), 2);

        assert_eq!(p.inv(0), 0);
        assert_eq!(p.inv(1), 2);
        assert_eq!(p.inv(2), 3);
        assert_eq!(p.inv(3), 1);
        test_inverse(&p);
    }
}
