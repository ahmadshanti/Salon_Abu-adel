import { View } from 'react-native';

// The root layout decides where to go (login / user / admin) based on the
// session, while the splash still covers the screen. Rendering a static
// redirect to login here would flash the login screen for logged-in users.
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: '#0A0A0F' }} />;
}
