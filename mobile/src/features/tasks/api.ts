import { createMobileApi } from '../../api/mobile';
import type { Fetch } from '../../api/transport';

// Bind the request to the selection read for this screen load.
export function assignedTasks(personId: string, send?: Fetch) {
  return createMobileApi(send, async () => personId).tasks();
}
