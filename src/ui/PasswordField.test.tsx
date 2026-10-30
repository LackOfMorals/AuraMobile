import ReactTestRenderer from 'react-test-renderer';
import { PasswordField } from './PasswordField';

const mockReveal = jest.fn();
jest.mock('../security/instanceVault', () => ({ instanceVault: { reveal: (...a: unknown[]) => mockReveal(...a) } }));
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { setString: jest.fn() } }));

const textOf = (n: ReactTestRenderer.ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const showButton = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(n => typeof n.props.onPress === 'function' && textOf(n) === 'Show password')[0]!;

describe('PasswordField', () => {
  beforeEach(() => mockReveal.mockReset());

  it('is disabled while the instance is being created, and asks for nothing', async () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<PasswordField auraId="d1" disabled />);
    });
    expect(showButton(r).props.disabled).toBe(true);
    await ReactTestRenderer.act(async () => {
      await showButton(r).props.onPress();
    });
    expect(mockReveal).not.toHaveBeenCalled();
  });

  it('asks for Face ID when it is not disabled', async () => {
    mockReveal.mockResolvedValue(null);
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<PasswordField auraId="d1" />);
    });
    expect(showButton(r).props.disabled).toBeFalsy();
    await ReactTestRenderer.act(async () => {
      await showButton(r).props.onPress();
    });
    expect(mockReveal).toHaveBeenCalledWith('d1');
  });
});
