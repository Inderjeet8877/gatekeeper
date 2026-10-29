import { Redirect } from 'expo-router';
import { homeFor, useSession } from '@/lib/session';

export default function Index() {
  return <Redirect href={homeFor(useSession())} />;
}
