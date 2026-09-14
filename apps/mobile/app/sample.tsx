import { router } from 'expo-router';

import { SampleWorkspace } from '../src/screens/SampleWorkspace';

export default function SampleRoute() {
  return <SampleWorkspace onExit={() => router.dismissTo('/')} />;
}
