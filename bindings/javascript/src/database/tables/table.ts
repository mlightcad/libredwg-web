export interface DwgCommonTableEntry {
  name: string
  handle: string
  ownerHandle: string
}

export interface DwgTable<T> {
  // name: string;
  // handle: string;
  // ownerDictionaryIds?: string[];
  // ownerObjectId: string;
  // maxNumberOfEntries: number;
  entries: T[]
}
