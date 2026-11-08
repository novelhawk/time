use std::rc::Rc;

/// A Hutton-Meijer monadic parser: `Inp -> [(A, Inp)]`
/// Returning a `Vec` represents the list of successes:
/// - An empty vector `[]` represents failure.
/// - A single-element vector represents a deterministic parse.
/// - Multiple elements represent ambiguous interpretations.
#[derive(Clone)]
pub struct Parser<'a, A> {
    pub parse_fn: Rc<dyn Fn(&'a str) -> Vec<(A, &'a str)> + 'a>,
}

impl<'a, A: 'a> Parser<'a, A> {
    pub fn new<F>(f: F) -> Self
    where
        F: Fn(&'a str) -> Vec<(A, &'a str)> + 'a,
    {
        Self {
            parse_fn: Rc::new(f),
        }
    }

    pub fn parse(&self, inp: &'a str) -> Vec<(A, &'a str)> {
        (self.parse_fn)(inp)
    }

    /// Monadic bind (`>>=`)
    pub fn bind<B: 'a, F>(self, f: F) -> Parser<'a, B>
    where
        F: Fn(A) -> Parser<'a, B> + 'a,
    {
        Parser::new(move |inp| {
            let mut results = Vec::new();
            for (val, rest) in self.parse(inp) {
                let next_parser = f(val);
                results.extend(next_parser.parse(rest));
            }
            results
        })
    }

    /// Functor map
    pub fn map<B: 'a, F>(self, f: F) -> Parser<'a, B>
    where
        F: Fn(A) -> B + 'a,
    {
        Parser::new(move |inp| {
            self.parse(inp)
                .into_iter()
                .map(|(val, rest)| (f(val), rest))
                .collect()
        })
    }

    /// Non-deterministic choice (`++`)
    /// Keeps ALL successful interpretations, embracing ambiguity.
    pub fn plus(self, other: Parser<'a, A>) -> Parser<'a, A> {
        Parser::new(move |inp| {
            let mut results = self.parse(inp);
            results.extend(other.parse(inp));
            results
        })
    }

    /// Deterministic biased choice (`+++`)
    /// If `self` succeeds with at least one result, returns it; otherwise tries `other`.
    pub fn or_else(self, other: Parser<'a, A>) -> Parser<'a, A> {
        Parser::new(move |inp| {
            let results = self.parse(inp);
            if !results.is_empty() {
                results
            } else {
                other.parse(inp)
            }
        })
    }
}

/// Monadic return / pure
pub fn result<'a, A: Clone + 'a>(val: A) -> Parser<'a, A> {
    Parser::new(move |inp| vec![(val.clone(), inp)])
}

/// Monadic zero / failure
pub fn zero<'a, A: 'a>() -> Parser<'a, A> {
    Parser::new(|_| Vec::new())
}

/// Parses a single character from the input stream
pub fn item<'a>() -> Parser<'a, char> {
    Parser::new(|inp| {
        let mut chars = inp.chars();
        match chars.next() {
            Some(c) => vec![(c, &inp[c.len_utf8()..])],
            None => Vec::new(),
        }
    })
}

/// Parses a character satisfying a predicate
pub fn sat<'a, F>(pred: F) -> Parser<'a, char>
where
    F: Fn(char) -> bool + 'a,
{
    item().bind(move |c| {
        if pred(c) {
            result(c)
        } else {
            zero()
        }
    })
}

/// Matches a specific character
pub fn char_p<'a>(expected: char) -> Parser<'a, char> {
    sat(move |c| c == expected)
}

/// Matches a specific character case-insensitively
pub fn char_ci<'a>(expected: char) -> Parser<'a, char> {
    sat(move |c| c.to_ascii_lowercase() == expected.to_ascii_lowercase())
}

/// Matches an exact literal string slice
pub fn string_p<'a>(expected: &'static str) -> Parser<'a, &'a str> {
    Parser::new(move |inp| {
        if inp.starts_with(expected) {
            vec![(expected, &inp[expected.len()..])]
        } else {
            Vec::new()
        }
    })
}

/// Matches a string case-insensitively
pub fn ascii_ci_string<'a>(expected: &'static str) -> Parser<'a, String> {
    Parser::new(move |inp| {
        if inp.len() >= expected.len() {
            let prefix = &inp[..expected.len()];
            if prefix.eq_ignore_ascii_case(expected) {
                return vec![(prefix.to_string(), &inp[expected.len()..])];
            }
        }
        Vec::new()
    })
}

/// Parses a single digit [0-9]
pub fn digit<'a>() -> Parser<'a, char> {
    sat(|c| c.is_ascii_digit())
}

/// Parses a single alphabetic char [a-zA-Z]
pub fn alpha<'a>() -> Parser<'a, char> {
    sat(|c| c.is_ascii_alphabetic())
}

/// Parses an alphanumeric char [a-zA-Z0-9]
pub fn alphanumeric<'a>() -> Parser<'a, char> {
    sat(|c| c.is_ascii_alphanumeric())
}

/// Parses a single whitespace character
pub fn space<'a>() -> Parser<'a, char> {
    sat(|c| c.is_whitespace())
}

/// Parses 0 or more whitespace characters
pub fn spaces<'a>() -> Parser<'a, String> {
    many(space()).map(|chars| chars.into_iter().collect())
}

/// Discards surrounding spaces around a parser
pub fn token<'a, A: Clone + 'a>(p: Parser<'a, A>) -> Parser<'a, A> {
    spaces()
        .bind(move |_| p.clone())
        .bind(move |val| spaces().map(move |_| val.clone()))
}

/// Parses 0 or more occurrences of `p` greedily
pub fn many<'a, A: Clone + 'a>(p: Parser<'a, A>) -> Parser<'a, Vec<A>> {
    Parser::new(move |inp| {
        let mut acc = Vec::new();
        let mut cur = inp;
        while let Some((val, rest)) = p.parse(cur).into_iter().next() {
            if rest.len() >= cur.len() {
                // Prevent infinite loop on zero-width match
                break;
            }
            acc.push(val);
            cur = rest;
        }
        vec![(acc, cur)]
    })
}

/// Parses 1 or more occurrences of `p`
pub fn many1<'a, A: Clone + 'a>(p: Parser<'a, A>) -> Parser<'a, Vec<A>> {
    let p_clone = p.clone();
    p.bind(move |first| {
        many(p_clone.clone()).map(move |mut rest| {
            rest.insert(0, first.clone());
            rest
        })
    })
}

/// Parses 1 or more occurrences of `p` separated by `sep`
pub fn sep_by1<'a, A: Clone + 'a, S: Clone + 'a>(
    p: Parser<'a, A>,
    sep: Parser<'a, S>,
) -> Parser<'a, Vec<A>> {
    let p_clone = p.clone();
    p.bind(move |first| {
        let p_inner = p_clone.clone();
        many(sep.clone().bind(move |_| p_inner.clone())).map(move |mut rest| {
            rest.insert(0, first.clone());
            rest
        })
    })
}

/// Left-associative operator chaining
/// E.g. `p` separated by `op`, combining values from left to right
pub fn chainl1<'a, A: Clone + 'a, F: Clone + 'a>(
    p: Parser<'a, A>,
    op: Parser<'a, F>,
) -> Parser<'a, A>
where
    F: Fn(A, A) -> A,
{
    Parser::new(move |inp| {
        let mut results = Vec::new();
        for (initial_val, current_inp) in p.parse(inp) {
            let mut acc = initial_val;
            let mut cur = current_inp;
            loop {
                let op_res = op.parse(cur);
                if let Some((op_fn, after_op)) = op_res.into_iter().next() {
                    let next_res = p.parse(after_op);
                    if let Some((next_val, after_p)) = next_res.into_iter().next() {
                        if after_p.len() >= cur.len() {
                            break;
                        }
                        acc = op_fn(acc, next_val);
                        cur = after_p;
                        continue;
                    }
                }
                break;
            }
            results.push((acc, cur));
        }
        results
    })
}

/// Parses 1 or more characters matching a predicate as a string slice
pub fn take_while1<'a, F>(pred: F) -> Parser<'a, &'a str>
where
    F: Fn(char) -> bool + 'a,
{
    Parser::new(move |inp| {
        let mut idx = 0;
        for c in inp.chars() {
            if pred(c) {
                idx += c.len_utf8();
            } else {
                break;
            }
        }
        if idx > 0 {
            vec![(&inp[..idx], &inp[idx..])]
        } else {
            Vec::new()
        }
    })
}

/// Parses 0 or more characters matching a predicate as a string slice
pub fn take_while<'a, F>(pred: F) -> Parser<'a, &'a str>
where
    F: Fn(char) -> bool + 'a,
{
    Parser::new(move |inp| {
        let mut idx = 0;
        for c in inp.chars() {
            if pred(c) {
                idx += c.len_utf8();
            } else {
                break;
            }
        }
        vec![(&inp[..idx], &inp[idx..])]
    })
}

/// Optional parser, returning Some(val) on success or None
pub fn opt<'a, A: Clone + 'a>(p: Parser<'a, A>) -> Parser<'a, Option<A>> {
    p.map(Some).or_else(result(None))
}

/// Parses an unsigned integer
pub fn u32_p<'a>() -> Parser<'a, u32> {
    take_while1(|c| c.is_ascii_digit()).bind(|s| {
        if let Ok(n) = s.parse::<u32>() {
            result(n)
        } else {
            zero()
        }
    })
}

/// Parses a signed integer
pub fn i32_p<'a>() -> Parser<'a, i32> {
    take_while1(|c| c.is_ascii_digit()).bind(|s| {
        if let Ok(n) = s.parse::<i32>() {
            result(n)
        } else {
            zero()
        }
    })
}

/// Succeeds only if input (after trimming whitespace) is empty
pub fn eof<'a>() -> Parser<'a, ()> {
    Parser::new(|inp| {
        if inp.trim().is_empty() {
            vec![((), "")]
        } else {
            Vec::new()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_result_and_zero() {
        let p_res = result(42);
        assert_eq!(p_res.parse("hello"), vec![(42, "hello")]);

        let p_zero: Parser<i32> = zero();
        assert!(p_zero.parse("hello").is_empty());
    }

    #[test]
    fn test_item() {
        let p = item();
        assert_eq!(p.parse("abc"), vec![('a', "bc")]);
        assert_eq!(p.parse(""), vec![]);
        assert_eq!(p.parse("🍕party"), vec![('🍕', "party")]);
    }

    #[test]
    fn test_bind_and_map() {
        let p = item().bind(|c1| item().map(move |c2| (c1, c2)));
        assert_eq!(p.parse("xyzzz"), vec![(('x', 'y'), "zzz")]);
    }

    #[test]
    fn test_plus_non_determinism() {
        let p1 = string_p("ab").map(|s| s.to_string());
        let p2 = string_p("a").map(|s| s.to_string());
        let combined = p1.plus(p2);

        // "abc" matches "ab" (rest: "c") AND "a" (rest: "bc")
        let results = combined.parse("abc");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0], ("ab".to_string(), "c"));
        assert_eq!(results[1], ("a".to_string(), "bc"));
    }

    #[test]
    fn test_or_else_deterministic() {
        let p1 = string_p("ab").map(|s| s.to_string());
        let p2 = string_p("a").map(|s| s.to_string());
        let biased = p1.or_else(p2);

        let results = biased.parse("abc");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], ("ab".to_string(), "c"));
    }

    #[test]
    fn test_many_and_many1() {
        let p = many(digit());
        assert_eq!(p.parse("123abc"), vec![(vec!['1', '2', '3'], "abc")]);
        assert_eq!(p.parse("abc"), vec![(vec![], "abc")]);

        let p1 = many1(digit());
        assert_eq!(p1.parse("123abc"), vec![(vec!['1', '2', '3'], "abc")]);
        assert!(p1.parse("abc").is_empty());
    }

    #[test]
    fn test_sep_by1() {
        let p = sep_by1(digit(), char_p(','));
        assert_eq!(p.parse("1,2,3;"), vec![(vec!['1', '2', '3'], ";")]);
    }

    #[test]
    fn test_chainl1() {
        let add = char_p('+').map(|_| (|a: i32, b: i32| a + b) as fn(i32, i32) -> i32);
        let num = digit().map(|c| c.to_digit(10).unwrap() as i32);
        let expr = chainl1(num, add);

        let results = expr.parse("1+2+3+4 remainder");
        assert_eq!(results, vec![(10, " remainder")]);
    }
}
