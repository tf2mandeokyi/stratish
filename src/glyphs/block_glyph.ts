import { Glyph } from './glyph';
import { Rectangle, Polygon, Pos2d, transformRectangle } from '../shapes';

export class BlockGlyph extends Glyph {

    readonly child_rect: Rectangle;

    constructor(shape: Polygon[], rect: Rectangle, child_rect: Rectangle, name: string) {
        super(shape, rect, `block-glyph ${name}`);
        this.child_rect = child_rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : BlockGlyph {
        let glyph_result = super.translate(func);
        return new BlockGlyph(glyph_result.shape, glyph_result.rect, transformRectangle(this.child_rect, func), this.class_name.replace("block-glyph ", ""));
    }

    fitToRectangle(rect: Rectangle) : BlockGlyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

}
