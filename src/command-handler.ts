import App from "./app";
import * as diff from "./diff";
import Settings from "./settings";

export default abstract class BaseCommandHandler {
  settings: Settings;

  abstract async focus(): Promise<any>;
  abstract highlightRanges(ranges: diff.DiffRange[]): number;
  abstract getActiveEditorText(): string | undefined;
  abstract async scrollToCursor(): Promise<any>;
  abstract select(startRow: number, startColumn: number, endRow: number, endColumn: number): void;
  abstract setSourceAndCursor(before: string, source: string, row: number, column: number): void;

  abstract COMMAND_TYPE_CLOSE_TAB(_data: any): Promise<any>;
  abstract COMMAND_TYPE_CLOSE_WINDOW(_data: any): Promise<any>;
  abstract COMMAND_TYPE_COPY(data: any): Promise<any>;
  abstract COMMAND_TYPE_CREATE_TAB(_data: any): Promise<any>;
  abstract COMMAND_TYPE_GET_EDITOR_STATE(_data: any): Promise<any>;
  abstract COMMAND_TYPE_GO_TO_DEFINITION(_data: any): Promise<any>;
  abstract COMMAND_TYPE_NEXT_TAB(_data: any): Promise<any>;
  abstract COMMAND_TYPE_PASTE(data: any): Promise<any>;
  abstract COMMAND_TYPE_PREVIOUS_TAB(_data: any): Promise<any>;
  abstract COMMAND_TYPE_REDO(_data: any): Promise<any>;
  abstract COMMAND_TYPE_SAVE(_data: any): Promise<any>;
  abstract COMMAND_TYPE_SPLIT(data: any): Promise<any>;
  abstract COMMAND_TYPE_SWITCH_TAB(data: any): Promise<any>;
  abstract COMMAND_TYPE_UNDO(_data: any): Promise<any>;
  abstract COMMAND_TYPE_WINDOW(data: any): Promise<any>;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  pasteText(source: string, data: any, text: string) {
    // if we specify a direction, it means that we want to paste as a line, so add a newline
    let insertionPoint = data.cursor || 0;
    let updatedCursor = insertionPoint;
    if (data.direction && !text.endsWith("\n")) {
      text += "\n";
    }

    // paste on a new line if a direction is specified or we're pasting a full line
    if (text.endsWith("\n") || data.direction) {
      // default to paste below if there's a newline at the end
      data.direction = data.direction || "below";

      // for below (the default), move the cursor to the start of the next line
      if (data.direction === "below") {
        for (; insertionPoint < source.length; insertionPoint++) {
          if (source[insertionPoint] === "\n") {
            insertionPoint++;
            break;
          }
        }
      }

      // for paste above, go to the start of the current line
      else if (data.direction === "above") {
        // if we're at the end of a line, then move the cursor back one, or else we'll paste below
        if (source[insertionPoint] === "\n" && insertionPoint > 0) {
          insertionPoint--;
        }

        for (; insertionPoint >= 0; insertionPoint--) {
          if (source[insertionPoint] === "\n") {
            insertionPoint++;
            break;
          }
        }
      }

      updatedCursor = insertionPoint;
    }

    // move the cursor to the end of the pasted text
    updatedCursor += text.length;
    if (text.endsWith("\n")) {
      updatedCursor--;
    }

    this.updateEditor(
      source.substring(0, insertionPoint) + text + source.substring(insertionPoint),
      updatedCursor
    );
  }

  async uiDelay() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
  }

  async updateEditor(source: string, cursor: number): Promise<any> {
    await this.focus();

    const before = this.getActiveEditorText() || "";
    source = source || "";
    let [row, column] = diff.cursorToRowAndColumn(source, cursor);
    if (!this.settings.getAnimations()) {
      this.setSourceAndCursor(before, source, row, column);
      await this.scrollToCursor();
      return Promise.resolve();
    }

    let ranges = diff.diff(before, source);
    if (ranges.length == 0) {
      ranges = [
        new diff.DiffRange(
          diff.DiffRangeType.Add,
          diff.DiffHighlightType.Line,
          new diff.DiffPoint(row, 0),
          new diff.DiffPoint(row + 1, 0)
        ),
      ];
    }

    const addRanges = ranges.filter(
      (e: diff.DiffRange) => e.diffRangeType == diff.DiffRangeType.Add
    );
    const deleteRanges = ranges.filter(
      (e: diff.DiffRange) => e.diffRangeType == diff.DiffRangeType.Delete
    );

    const timeout = this.highlightRanges(deleteRanges);
    return new Promise((resolve) => {
      setTimeout(
        async () => {
          this.setSourceAndCursor(before, source, row, column);
          this.highlightRanges(addRanges);
          await this.scrollToCursor();
          resolve();
        },
        deleteRanges.length > 0 ? timeout : 1
      );
    });
  }

  async COMMAND_TYPE_DIFF(data: any): Promise<any> {
    await this.updateEditor(data.source, data.cursor);
  }

  async COMMAND_TYPE_SELECT(data: any): Promise<any> {
    const [startRow, startColumn] = diff.cursorToRowAndColumn(data.source, data.cursor);
    const [endRow, endColumn] = diff.cursorToRowAndColumn(data.source, data.cursorEnd);
    this.select(startRow, startColumn, endRow, endColumn);
  }
}
