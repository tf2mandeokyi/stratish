import { Glyph } from './glyph';
import { Rect, Polygon, Pos2d, transform_rect } from '../shapes';

export class BlockGlyph extends Glyph {

    readonly child_rect: Rect;

    constructor(shape: Polygon[], rect: Rect, child_rect: Rect, name: string) {
        super(shape, rect, `block-glyph ${name}`);
        this.child_rect = child_rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : BlockGlyph {
        let glyph_result = super.translate(func);
        return new BlockGlyph(glyph_result.shape, glyph_result.rect, transform_rect(this.child_rect, func), this.class_name.replace("block-glyph ", ""));
    }

    fit_to_rect(rect: Rect) : BlockGlyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

}
