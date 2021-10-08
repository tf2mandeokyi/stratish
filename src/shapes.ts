export type Pos2d = [number, number];

export type Polygon = Pos2d[];

export type IndexPos2dFunc = (index: number) => Pos2d;

export interface Rectangle {
    x: number, y: number, w: number, h: number;
}

export function transformRectangle(rect: Rectangle, func: (pos: Pos2d) => Pos2d) : Rectangle {
    let lt : Pos2d = func([rect.x, rect.y]);
    let rb : Pos2d = func([rect.x + rect.w, rect.y + rect.h]);
    return { x: Math.min(lt[0], rb[0]), y: Math.min(lt[1], rb[1]), w: Math.abs(rb[0] - lt[0]), h: Math.abs(rb[1] - lt[1]) };
}

export function pos2dToString(pos: Pos2d) : string {
    return `${pos[0]} ${pos[1]}`
}
