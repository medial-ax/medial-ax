use serde::{Deserialize, Serialize};

use crate::sneaky_matrix::CI;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "python", pyo3::pyclass)]
pub struct Permutation {
    forwards: Vec<CI>,
    backwards: Vec<CI>,
}

#[cfg_attr(feature = "python", pyo3::pymethods)]
impl Permutation {
    pub fn map(&self, a: CI) -> CI {
        self.forwards[a as usize]
    }

    pub fn inv(&self, a: CI) -> CI {
        self.backwards[a as usize]
    }
}

impl Permutation {
    pub fn new(n: CI) -> Self {
        Permutation {
            forwards: (0..n).collect(),
            backwards: (0..n).collect(),
        }
    }

    pub fn mem_usage(&self) -> usize {
        std::mem::size_of_val(&self.forwards[0])
            * (self.forwards.capacity() + self.backwards.capacity())
    }

    pub fn push_n(&mut self, n: CI) {
        let off = self.forwards.len() as CI;
        self.forwards.reserve(n as usize);
        self.backwards.reserve(n as usize);
        for i in 0..n {
            self.forwards.push(off + i);
            self.backwards.push(off + i);
        }
    }

    pub fn from_forwards(forwards: Vec<CI>) -> Self {
        let mut backwards: Vec<CI> = vec![0; forwards.len()];
        for (i, &f) in forwards.iter().enumerate() {
            backwards[f as usize] = i as CI;
        }
        Permutation {
            forwards,
            backwards,
        }
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
    pub fn swap(&mut self, a: CI, b: CI) {
        self.forwards.swap(a as usize, b as usize);
        self.backwards.swap(
            self.forwards[a as usize] as usize,
            self.forwards[b as usize] as usize,
        );
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

        let forwards = v.iter().map(|&(i, _)| i as CI).collect::<Vec<CI>>();
        let mut backwards: Vec<CI> = vec![0; forwards.len()];
        for (i, &f) in forwards.iter().enumerate() {
            backwards[f as usize] = i as CI;
        }
        Permutation {
            forwards,
            backwards,
        }
    }

    pub fn into_forwards(self) -> Vec<CI> {
        self.forwards
    }

    pub fn into_backwards(self) -> Vec<CI> {
        self.backwards
    }

    /// Given two orderings `a` and `b`, return the permutation `p` such that
    /// `p[a[i]] == b[i]`.
    pub fn from_to(a: &Self, b: &Self) -> Self {
        let mut v: Vec<CI> = vec![0; a.len()];
        for i in 0..(a.len() as CI) {
            v[a.map(i) as usize] = b.map(i);
        }
        Self::from_forwards(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_inverse(p: &Permutation) {
        for i in 0..p.len() as CI {
            assert_eq!(p.inv(p.map(i)), i);
            assert_eq!(p.map(p.inv(i)), i);
        }
    }

    #[test]
    fn permutation() {
        let mut p = Permutation::new(10);

        for i in 0..p.len() as CI {
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
        for i in 0..(p.len() - 1) as CI {
            assert!(v[p.map(i) as usize] <= v[p.map(i + 1) as usize]);
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
