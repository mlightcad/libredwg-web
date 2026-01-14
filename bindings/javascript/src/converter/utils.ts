const MODEL_SPACE = '*MODEL_SPACE'
const MODEL_SPACE_PREFIX = '*PAPER_SPACE'

export const isModelSpace = (name: string) => {
  return name && name.toUpperCase() == MODEL_SPACE
}

export const isPaperSpace = (name: string) => {
  return name && name.toUpperCase().startsWith(MODEL_SPACE_PREFIX)
}

export const idToString = (id: number | bigint) => {
  return id.toString(16).toUpperCase()
}
