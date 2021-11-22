import * as glyphdata from '../resources/glyph.json';
import { Pos2d, IndexPos2dFunc, Rectangle, Polygon, pos2dToString } from './shapes';
import { Glyph, BlockGlyph, DecalGlyph } from './glyphs'


interface GlyphJsonParseResult {
    block_glyphs: { [alphabet: string] : BlockGlyph },
    decal_glyphs: { [alphabet: string] : DecalGlyph }
}


function pointStringToPolygon(points: string, translate: Pos2d = [0, 0]) : Polygon {
    const pointArray = points.split(' ');
    let polygon : Polygon = [];

    for(const pointString of pointArray) {
        let point = pointString.split(',');
        polygon.push([Number.parseInt(point[0]) + translate[0], Number.parseInt(point[1]) + translate[1]]);
    }

    return polygon;
}


function parseGlyphJson() : GlyphJsonParseResult {
    let result : GlyphJsonParseResult = { block_glyphs: {}, decal_glyphs: {} };

    for(const alphabet of Object.keys(glyphdata.block_glyphs)) {
        const glyphJson = glyphdata.block_glyphs[alphabet];
        let shape : Polygon[] = [];

        for(const polygonString of glyphJson.shape) {
            shape.push(pointStringToPolygon(polygonString));
        }

        result.block_glyphs[alphabet] = new BlockGlyph(
            shape, 
            { x: 0, y: 0, w: 10, h: 10 },
            { x: glyphJson.child_pos[0], y: glyphJson.child_pos[1], w: 4, h: 4 },
            alphabet
        );
    }

    for(const alphabet of Object.keys(glyphdata.decal_glyphs)) {
        const glyphJson = glyphdata.decal_glyphs[alphabet];
        let shape : Polygon[] = [];

        for(const polygonString of glyphJson.shape) {
            shape.push(pointStringToPolygon(polygonString));
        }

        result.decal_glyphs[alphabet] = new DecalGlyph(
            shape, 
            { x: 0, y: 0, w: 10, h: -glyphJson.height },
            glyphJson.height,
            alphabet
        );
    }

    return result;
}


export class GlyphBuilder {

    static vowels = "aeiouy";
    static parse_result = parseGlyphJson();

    glyphs: Glyph[];
    start_pos: Pos2d;
    current_index: number;
    special_glyphs: boolean;
    child_depth: number;
    scale: number;
    reserved: { [x: string]: boolean };
    occupied: { [x: string]: boolean };
    pos_func: IndexPos2dFunc;

    constructor({allow_special_glyphs = true, child_depth = 1, positionFunction = index => [index, 0], scale = 1}: {
        allow_special_glyphs?: boolean,
        child_depth?: number,
        scale?: number,
        positionFunction?: IndexPos2dFunc
    }) {
        this.start_pos = [0, 0];
        this.glyphs = [];
        this.current_index = 0;
        this.scale = scale;
        this.special_glyphs = allow_special_glyphs;
        this.child_depth = child_depth;
        this.reserved = {}; this.occupied = {};
        this.pos_func = positionFunction;
    }

    getTotalBlockGlyphCount() : number {
        return this.current_index;
    }

    addSentence(sentence: string) : GlyphBuilder {
        let word = "", char: string;
        for(var i = 0; i < sentence.length; ++i) {
            char = sentence.charAt(i).toLocaleLowerCase();
            let charCode = char.charCodeAt(0);

            if(charCode >= 48 && charCode <= 57) { // char: ('0' ~ '9')
                if(word !== '') this.addSingleWord(word, false);
                this.addBlockGlyph(char);
                word = "";
            }
            else switch(char) {
                case ' ':
                    if(word !== '') this.addSingleWord(word, false);
                    word = "";
                    break;
                case ':':
                    if(word !== '') this.addSingleWord(word, false);
                    this.addBlockGlyph(":");
                    word = "";
                    break;
                case '.':
                    if(word !== '') this.addSingleWord(word, false);
                    this.addBlockGlyph(".");
                    word = "";
                    break;
                default:
                    word += char;
            }
        }
        if(word !== '') this.addSingleWord(word, true);
        return this;
    }

    addSingleWord(word: string, last: boolean) : GlyphBuilder {

        switch(word) {
            case 'i':
            case 'me':
                if(this.special_glyphs) {
                    this.addBlockGlyph("me");
                    break;
                }
            case 'you':
                if(this.special_glyphs) {
                    this.addBlockGlyph("you");
                    break;
                }
            default:
                let first : string[] = [], second : string[] = [];
                for(var i = 0; i < word.length; ++i) {
                    let char = word.charAt(i).toLocaleLowerCase();
                    if(GlyphBuilder.vowels.includes(char)) second.push(char);
                    else {
                        first.push(char);
                    }
                }

                let bothFirstAndLastExists = first.length != 0 && second.length != 0;
                
                this.reserved[pos2dToString(this.pos_func(this.current_index))] = true;
                if(bothFirstAndLastExists || (!bothFirstAndLastExists && !last)) this.reserved[pos2dToString(this.pos_func(this.current_index + 1))] = true;
                if(bothFirstAndLastExists && !last) this.reserved[pos2dToString(this.pos_func(this.current_index + 2))] = true;
                
                this.addGlyph(first);
                this.addGlyph(second);
                return this;
        }
    }

    private addBlockGlyph(letter: string) : {glyph: BlockGlyph, position: Pos2d} {
        let translate_pos : Pos2d = this.pos_func(this.current_index);
        if(this.occupied[pos2dToString(translate_pos)]) {
            throw new Error(`Glyph collision! (at: x=${translate_pos[0]}, y=${translate_pos[1]})`);
        }
        this.occupied[pos2dToString(translate_pos)] = true;
        translate_pos = [translate_pos[0] * 11 + this.start_pos[0], translate_pos[1] * 11 + this.start_pos[1]];

        let glyph = GlyphBuilder.parse_result.block_glyphs[letter];
        if(!glyph) {
            throw new Error(`Illegal block character found: ${letter}`);
        }
        glyph = GlyphBuilder.parse_result.block_glyphs[letter].translate(pos => [pos[0] + translate_pos[0], pos[1] + translate_pos[1]]);
        this.glyphs.push(glyph);
        this.current_index++;
        return { glyph, position: translate_pos };
    }

    private addDecalGlyphs(letters: string[], position: Pos2d, func: (pos: Pos2d) => Pos2d) : void {
        let height = 1, decal_glyph: DecalGlyph;
        for(var i = 0; i < letters.length; ++i) {
            if(i == letters.length - 1 && letters[i] == letters[i-1]) {
                decal_glyph = GlyphBuilder.parse_result.decal_glyphs["ditto"];
            }
            else {
                decal_glyph = GlyphBuilder.parse_result.decal_glyphs[letters[i]];
            }
            if(!decal_glyph) {
                throw new Error(`Illegal decal character found: ${letters[i]}`);
            }
            decal_glyph = decal_glyph.translate(pos => {
                let pos1 = func([pos[0], pos[1] - height]);
                return [pos1[0] + position[0], pos1[1] + position[1]]
            })
            let bbox = decal_glyph.rect;
            let lt: Pos2d = [Math.floor(bbox.x / 11), Math.floor(bbox.y / 11)], 
                rb: Pos2d = [Math.floor((bbox.x + bbox.w) / 11), Math.floor((bbox.y + bbox.h) / 11)];
            this.glyphs.push(decal_glyph);
            this.occupied[pos2dToString(lt)] = this.occupied[pos2dToString(rb)] = true;
            height += decal_glyph.height + 1;
        }
    }

    private addGlyph(letters: string[]) : void {
        if(letters.length != 0) {
            let { glyph, position } = this.addBlockGlyph(letters[0]);
            let { block_glyphs, decal_glyphs } = GlyphBuilder.parse_result;

            if(letters.length != 1) {
                let i = 1, rect = glyph.child_rect;

                for(; i < this.child_depth+1; ++i) {
                    if(i >= letters.length) break;
                    let child_glyph = block_glyphs[letters[i]].fitToRectangle(rect);
                    rect = child_glyph.child_rect;
                    this.glyphs.push(child_glyph);
                }
        
                let decals: [string[], string[], string[], string[]] = [[], [], [], []], 
                    heights: [number, number, number, number] = [1, 1, 1, 1],
                    decal_glyph: DecalGlyph, fail_count = 0;
                const funcs: ((pos: Pos2d) => Pos2d)[] = [
                    pos => pos,
                    pos => [10 - pos[1], pos[0]],
                    pos => [10 - pos[0], 10 - pos[1]],
                    pos => [pos[1], 10 - pos[0]]
                ]
                for(var j = 0; i < letters.length; ++j, ++i) {
                    if(fail_count >= 4) {
                        throw new Error(`No space to put decal(s) at! (at: x=${position[0]}, y=${position[1]})`)
                    }
                    if(letters[i] == decals[j % 4][decals[j % 4].length - 1]) {
                        decal_glyph = GlyphBuilder.parse_result.decal_glyphs["ditto"];
                    }
                    else {
                        decal_glyph = GlyphBuilder.parse_result.decal_glyphs[letters[i]];
                    }
                    if(!decal_glyph) {
                        throw new Error(`Illegal decal character found: "${letters[i]}"`);
                    }
                    let bbox = decal_glyph.translate(pos => {
                        let pos1 = funcs[j % 4]([pos[0], pos[1] - heights[j % 4]]);
                        return [pos1[0] + position[0], pos1[1] + position[1]]
                    }).rect;
                    let lt: Pos2d = [Math.floor(bbox.x / 11), Math.floor(bbox.y / 11)], 
                        rb: Pos2d = [Math.floor((bbox.x + bbox.w) / 11), Math.floor((bbox.y + bbox.h) / 11)];
                    if(this.reserved[pos2dToString(lt)] || this.reserved[pos2dToString(rb)] || this.occupied[pos2dToString(lt)] || this.occupied[pos2dToString(rb)]) {
                        --i; ++fail_count; continue;
                    }
                    fail_count = 0;
                    decals[j % 4].push(letters[i]);
                    heights[j % 4] += decal_glyphs[letters[i]].height + 1;
                }
                for(i = 0; i < 4; ++i) {
                    this.addDecalGlyphs(decals[i], position, funcs[i]);
                }
            }
        }
    }

    toSVGElement(document: XMLDocument, polygon_attrs: { [key: string]: string }) : SVGSVGElement {
        let min : Pos2d = [0, 0], max: Pos2d = [0, 0];
        for(const glyph of this.glyphs) {
            if(glyph.rect.x < min[0]) min[0] = glyph.rect.x;
            if(glyph.rect.y < min[1]) min[1] = glyph.rect.y;
            if(glyph.rect.x + glyph.rect.w > max[0]) max[0] = glyph.rect.x + glyph.rect.w;
            if(glyph.rect.y + glyph.rect.h > max[1]) max[1] = glyph.rect.y + glyph.rect.h;
        }
        let bbox : Rectangle = { x: min[0], y: min[1], w: max[0] - min[0], h: max[1] - min[1] };

        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", this.scale * bbox.w + "");
        svg.setAttribute("height", this.scale * bbox.h + "");
        for(const glyph of this.glyphs) {
            let glyph1 = glyph.translate(pos => [this.scale * (pos[0] - min[0]), this.scale * (pos[1] - min[1])]);
            svg.appendChild(glyph1.toSVGGroupElement(document, polygon_attrs));
        }
        return svg;
    }

}



