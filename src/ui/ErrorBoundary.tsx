import { Component, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './index';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * If a screen throws while rendering, show this instead of a blank screen, and let the person try again.
 * It says nothing about the error itself: that could include an instance name or a URL.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <View accessibilityRole="alert" style={styles.box}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>Your Aura account and your data are unaffected. Try again, and if it keeps happening, close and reopen the app.</Text>
        <Button label="Try again" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  text: { fontSize: 17 },
});
