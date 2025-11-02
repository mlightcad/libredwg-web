export interface DwgClass {
  /**
   * Class DXF record name; always unique
   */
  dxfName: string
  /**
   * C++ class name. Used to bind with software that defines object class behavior; always unique
   */
  cppName: string
  /**
   * Application name. Posted in Alert box when a class definition listed in this section is not currently loaded
   */
  appName: string
  /**
   * Proxy capabilities flag. Bit-coded value that indicates the capabilities of this object as a proxy:
   * - 0 = No operations allowed (0)
   * - 1 = Erase allowed (0x1)
   * - 2 = Transform allowed (0x2)
   * - 4 = Color change allowed (0x4)
   * - 8 = Layer change allowed (0x8)
   * - 16 = Linetype change allowed (0x10)
   * - 32 = Linetype scale change allowed (0x20)
   * - 64 = Visibility change allowed (0x40)
   * - 128 = Cloning allowed (0x80)
   * - 256 = Lineweight change allowed (0x100)
   * - 512 = Plot Style Name change allowed (0x200)
   * - 895 = All operations except cloning allowed (0x37F)
   * - 1023 = All operations allowed (0x3FF)
   * - 1024 = Disables proxy warning dialog (0x400)
   * - 32768 = R13 format proxy (0x8000)
   */
  capabilitiesFlag: number
  /**
   * Instance count for a custom class
   */
  instanceCount: number
  /**
   * Was-a-proxy flag. Set to 1 if class was not loaded when this DXF file was created,
   * and 0 otherwise
   */
  wasAProxyFlag: boolean
  /**
   * Is-an-entity flag. Set to 1 if class was derived from the AcDbEntity class and can reside in 
   * the BLOCKS or ENTITIES section. If 0, instances may appear only in the OBJECTS section
   */
  isAnEntityFlag: boolean
}
