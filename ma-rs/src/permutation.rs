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

    pub fn from_forwards(forwards: Vec<usize>) -> Self {
        let mut backwards = vec![0; forwards.len()];
        for (i, &f) in forwards.iter().enumerate() {
            backwards[f] = i;
        }
        Permutation {
            forwards,
            backwards,
        }
    }

    pub fn map(&self, a: usize) -> usize {
        self.forwards[a]
    }

    pub fn inv(&self, a: usize) -> usize {
        self.backwards[a]
    }

    /// Reverse the permutation.
    pub fn reverse(&mut self) {
        std::mem::swap(&mut self.forwards, &mut self.backwards);
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

    /// Construct a permutation from a list of [Ord] elements. The returned
    /// permutation will permute the elements (0..n) to the order such that the
    /// `O` elements are sorted.
    ///
    /// In order words, the permutation takes "ordered" indices to "original"
    /// indices, namely the index at which the element were in the input slice.
    pub fn from_ord<O: Ord + Copy>(es: &[O]) -> Self {
        let mut v = es.into_iter().enumerate().collect::<Vec<_>>();
        v.sort_by_key(|&(_, e)| e);

        let forwards = v.iter().map(|&(i, _)| i).collect::<Vec<_>>();
        let mut backwards = vec![0; forwards.len()];
        for (i, &f) in forwards.iter().enumerate() {
            backwards[f] = i;
        }
        Permutation {
            forwards,
            backwards,
        }
    }

    pub fn into_forwards(self) -> Vec<usize> {
        self.forwards
    }

    pub fn into_backwards(self) -> Vec<usize> {
        self.backwards
    }

    /// Given two orderings `a` and `b`, return the permutation `p` such that
    /// `p[a[i]] == b[i]`.
    pub fn from_to(a: &Self, b: &Self) -> Self {
        let mut v = vec![0; a.len()];
        for i in 0..a.len() {
            v[a.map(i)] = b.map(i);
        }
        Self::from_forwards(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_inverse(p: &Permutation) {
        for i in 0..p.len() {
            assert_eq!(p.inv(p.map(i)), i);
            assert_eq!(p.map(p.inv(i)), i);
        }
    }

    #[test]
    fn permutation() {
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

    #[test]
    fn from_ord() {
        let v = vec!['d', 'a', 'b', 'e', 'c'];
        let p = Permutation::from_ord(&v);
        for i in 0..p.len() - 1 {
            assert!(v[p.map(i)] <= v[p.map(i + 1)]);
        }
        assert_eq!(p.map(0), 1);
        assert_eq!(p.map(1), 2);
        assert_eq!(p.map(2), 4);
        assert_eq!(p.map(3), 0);
        assert_eq!(p.map(4), 3);

        test_inverse(&p);
    }

    #[test]
    fn from_to_already_id() {
        let a = Permutation::from_forwards(vec![0, 1, 2, 3, 4]);
        let b = Permutation::from_forwards(vec![3, 2, 0, 1, 4]);
        let p = Permutation::from_to(&a, &b);
        // We want `p[a[i]] == b[i]`
        assert_eq!(p.into_forwards(), vec![3, 2, 0, 1, 4]);
    }

    #[test]
    fn from_to_equal_inputs() {
        let a = Permutation::from_forwards(vec![2, 4, 1, 0, 3]);
        let b = Permutation::from_forwards(vec![2, 4, 1, 0, 3]);
        let p = Permutation::from_to(&a, &b);
        // We want `p[a[i]] == b[i]`
        assert_eq!(p.into_forwards(), vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn from_to_test1() {
        let a = Permutation::from_forwards(vec![2, 1, 4, 0, 3]);
        let b = Permutation::from_forwards(vec![3, 2, 0, 4, 1]);
        let p = Permutation::from_to(&a, &b);
        // We want `p[a[i]] == b[i]`
        // i = 0: a[0] = 2, b[0] = 3, p[2] = 3
        // i = 1: a[1] = 1, b[1] = 2, p[1] = 2
        // i = 2: a[2] = 4, b[2] = 0, p[4] = 0
        // i = 3: a[3] = 0, b[3] = 4, p[0] = 4
        // i = 4: a[4] = 3, b[4] = 1, p[3] = 1
        assert_eq!(p.into_forwards(), vec![4, 2, 3, 1, 0]);
    }
}
