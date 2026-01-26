import { DwgCommonObject } from './common'

/**
 * Duplicate record cloning flag (determines how to merge duplicate entries)
 * - 0: Not applicable
 * - 1: Keep existing
 * - 2: Use clone
 * - 3: <xref>$0$<name>
 * - 4: $0$<name>
 * - 5: Unmangle name
 */
export enum DwgDictionaryCloningFlags {
  NotApplicable = 0, // Not applicable.
  KeepExisting = 1, // Keep existing.
  UseClone = 2, // Use clone.
  XrefName = 3, // External reference name.
  Name = 4,
  UnmangleName = 5, // Unmangle name.
}

export interface DwgDictionaryObject extends DwgCommonObject {
  entries: Record<string, string>
  /**
   * Hard-owner flag. If set to 1, indicates that elements of the dictionary are to be treated as hard-owned
   */
  isHardOwner: boolean
  /**
   * Duplicate record cloning flag
   */
  cloningFlag: DwgDictionaryCloningFlags
}
