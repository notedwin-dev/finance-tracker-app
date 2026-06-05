import * as SheetService from "../../../../services/sheets.services";

export const checkSheetClientReady = (): boolean => {
  return SheetService.isClientReady();
};
