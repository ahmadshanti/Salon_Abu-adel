import { Linking } from 'react-native';

export function openWhatsApp(phone: string, message = '') {
  const cleaned = phone.replace(/[^0-9]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`);
}
