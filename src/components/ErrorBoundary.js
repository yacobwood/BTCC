import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error) {
    return {hasError: true, error};
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({hasError: false, error: null})}
            accessibilityLabel="Try again"
            accessibilityRole="button">
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', padding: 24},
  title: {color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8},
  message: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24},
  btn: {backgroundColor: Colors.yellow, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10},
  btnText: {color: Colors.navy, fontWeight: '700', fontSize: 14},
});
