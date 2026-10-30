import { Text } from './Text';
import ReactTestRenderer from 'react-test-renderer';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) {
    throw new Error('instance orders-prod at neo4j+s://d0000001.databases.neo4j.io');
  }
  return <Text>fine</Text>;
}

const texts = (r: ReactTestRenderer.ReactTestRenderer) => JSON.stringify(r.toJSON());

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows a recovery screen instead of a blank one, without leaking what failed', async () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      );
    });
    expect(texts(r)).toContain('Something went wrong');
    expect(texts(r)).not.toContain('orders-prod');
    expect(texts(r)).not.toContain('neo4j+s');
  });

  it('renders again when the person taps Try again and the problem is gone', async () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      );
    });
    shouldThrow = false;
    const retry = r.root.findAll(n => n.props.accessibilityRole === 'button')[0]!;
    await ReactTestRenderer.act(() => retry.props.onPress());
    expect(texts(r)).toContain('fine');
  });

  it('passes children straight through when nothing fails', async () => {
    shouldThrow = false;
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      );
    });
    expect(texts(r)).toContain('fine');
  });
});
