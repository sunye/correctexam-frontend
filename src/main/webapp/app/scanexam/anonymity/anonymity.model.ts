export interface IAnonymityExamDTO {
  id?: number;
  anonymousNumber: string;
  examId: number;
  sheetId?: number | null;
}

export interface IJuryMappingDTO {
  anonymousNumber: string;
  ine: string;
}

export interface IAnonGradeLine {
  anonymousNumber: string;
  note: number;
}
