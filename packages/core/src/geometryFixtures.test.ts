import { magnitude, mirroredAsymmetry, reflexOffset } from "./geometry";

// Shared with ml/tests/test_geometry_parity.py so the Python reference and the app agree.
type Pair = [number, number];
interface Fixtures {
  offsets: { name: string; irisCenter: Pair; irisRadius: number; reflex: Pair; expected: Pair }[];
  asymmetry: {
    name: string;
    imageLeft: Pair;
    imageRight: Pair;
    expected: { asymmetry: Pair; magnitude: number };
  }[];
}

const fixtures = jest.requireActual<Fixtures>("../fixtures/geometry.json");
const point = ([x, y]: Pair) => ({ x, y });

test.each(fixtures.offsets)("reflex offset fixture: $name", (c) => {
  const offset = reflexOffset(point(c.irisCenter), c.irisRadius, point(c.reflex));
  expect(offset.x).toBeCloseTo(c.expected[0], 9);
  expect(offset.y).toBeCloseTo(c.expected[1], 9);
});

test.each(fixtures.asymmetry)("asymmetry fixture: $name", (c) => {
  const a = mirroredAsymmetry(point(c.imageLeft), point(c.imageRight));
  expect(a.x).toBeCloseTo(c.expected.asymmetry[0], 9);
  expect(a.y).toBeCloseTo(c.expected.asymmetry[1], 9);
  expect(magnitude(a)).toBeCloseTo(c.expected.magnitude, 9);
});
