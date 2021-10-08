import { Glyph } from './glyph';
import { Rectangle, Polygon, Pos2d } from '../shapes';

export class DecalGlyph extends Glyph {

    readonly height: number;

    constructor(shape: Polygon[], rect: Rectangle, height: number, name: string) {
        super(shape, rect, `decal-glyph ${name}`);
        this.height = height;
    }

    translate(func: (pos: Pos2d) => Pos2d) : DecalGlyph {
        let glyph_result = super.translate(func);
        return new DecalGlyph(glyph_result.shape, glyph_result.rect, this.height, this.class_name.replace("decal-glyph ", ""));
    }

}