import * as fs from 'fs';
import * as glyphdata from './glyph.json';
import { DOMImplementation, XMLSerializer } from 'xmldom';
import { Command } from 'commander';



type Pos2d = [number, number];
type Polygon = Pos2d[];
interface Rect {
    x: number, y: number, w: number, h: number;
}

interface GlyphJsonParseResult {
    block_glyphs: { [alphabet: string] : BlockGlyph },
    decal_glyphs: { [alphabet: string] : DecalGlyph }
}



function transform_rect(rect: Rect, func: (pos: Pos2d) => Pos2d) : Rect {
    let lt : Pos2d = func([rect.x, rect.y]);
    let rb : Pos2d = func([rect.x + rect.w, rect.y + rect.h]);
    return { x: Math.min(lt[0], rb[0]), y: Math.min(lt[1], rb[1]), w: Math.abs(rb[0] - lt[0]), h: Math.abs(rb[1] - lt[1]) };
}



function pos2dToString(pos: Pos2d) : string {
    return `${pos[0]} ${pos[1]}`
}



class Glyph {

    shape: Polygon[];
    rect: Rect;

    constructor(shape: Polygon[], rect: Rect) {
        this.shape = shape;
        this.rect = rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : Glyph {
        let new_shape : Polygon[] = [];
        for(const polygon of this.shape) {
            let new_polygon : Polygon = [];
            for(const point of polygon) {
                new_polygon.push(func(point));
            }
            new_shape.push(new_polygon);
        }
        return new Glyph(new_shape, transform_rect(this.rect, func));
    }

    fit_to_rect(rect: Rect) : Glyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

    to_svg_polygon(xmlDoc: XMLDocument, args: {fill: string}) : SVGPolygonElement[] {
        let result : SVGPolygonElement[] = [];

        for(const polygon of this.shape) {
            let element = xmlDoc.createElementNS("http://www.w3.org/2000/svg", "polygon");
            let points = `${polygon[0][0]},${polygon[0][1]}`;
            for(var i = 1; i < polygon.length; ++i) {
                points += ` ${polygon[i][0]},${polygon[i][1]}`;
            }
            element.setAttribute("points", points);
            element.setAttribute("fill", args.fill);
            result.push(element);
        }

        return result;
    }
}



class BlockGlyph extends Glyph {

    child_rect: Rect;

    constructor(shape: Polygon[], rect: Rect, child_rect: Rect) {
        super(shape, rect);
        this.child_rect = child_rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : BlockGlyph {
        let glyph_result = super.translate(func);
        return new BlockGlyph(glyph_result.shape, glyph_result.rect, transform_rect(this.child_rect, func));
    }

    fit_to_rect(rect: Rect) : BlockGlyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

}



class DecalGlyph extends Glyph {

    height: number;

    constructor(shape: Polygon[], rect: Rect, height: number) {
        super(shape, rect);
        this.height = height;
    }

    translate(func: (pos: Pos2d) => Pos2d) : DecalGlyph {
        let glyph_result = super.translate(func);
        return new DecalGlyph(glyph_result.shape, glyph_result.rect, this.height);
    }

}



class GlyphBuilder {

    static vowels = "aeiouy";
    static parse_result = GlyphBuilder.parseGlyphJson();

    glyphs: Glyph[];
    start_pos: Pos2d;
    index: number;
    special_glyphs: boolean;
    child_depth: number;
    scale: number;
    fill: string;
    reserved: { [x: string]: boolean };
    occupied: { [x: string]: boolean };
    pos_func: (index: number) => Pos2d;

    constructor({allow_special_glyphs = true, child_depth = 1, custom_pos_func = index => [index, 0], scale = 1, fill = "#000000"}: {
        allow_special_glyphs?: boolean,
        child_depth?: number,
        scale?: number,
        fill?: string,
        custom_pos_func?: (index: number) => Pos2d
    }) {
        this.start_pos = [0, 0];
        this.glyphs = [];
        this.index = 0;
        this.scale = scale;
        this.special_glyphs = allow_special_glyphs;
        this.child_depth = child_depth;
        this.reserved = {}; this.occupied = {};
        this.fill = fill;
        this.pos_func = custom_pos_func;
    }

    add_sentence(sentence: string) : GlyphBuilder {
        let word = "", char: string;
        for(var i = 0; i < sentence.length; ++i) {
            char = sentence.charAt(i).toLocaleLowerCase();
            switch(char) {
                case ' ':
                    if(word !== '') {
                        this.add_single_word(word, false);
                        word = "";
                    }
                    break;
                case ':':
                    this.add_single_word(word, false);
                    this.add_block_glyph(":");
                    word = "";
                    break;
                case '.':
                    this.add_single_word(word, false);
                    this.add_block_glyph(".");
                    word = "";
                    break;
                default:
                    word += char;
            }
        }
        if(word !== '') {
            this.add_single_word(word, true);
        }
        return this;
    }

    add_single_word(word: string, last: boolean) : GlyphBuilder {

        switch(word) {
            case 'i':
                this.add_block_glyph("first_person");
                break;
            case 'the':
            case 'that':
            case 'they':
                if(this.special_glyphs) {
                    this.add_block_glyph("the");
                    break;
                }
            default:
                let first : string[] = [], second : string[] = [];
                for(var i = 0; i < word.length; ++i) {
                    let char = word.charAt(i).toLocaleLowerCase();
                    if(GlyphBuilder.vowels.includes(char)) second.push(char);
                    else {
                        if(char == 'j' && first.length <= this.child_depth) {
                            first.push('d', 'z');
                        } // TODO: remove this when j-block-glyph is found
                        else {
                            first.push(char);
                        }
                    }
                }
                this.reserved[pos2dToString(this.pos_func(this.index))] = true;
                this.reserved[pos2dToString(this.pos_func(this.index + 1))] = true;
                if(!last) this.reserved[pos2dToString(this.pos_func(this.index + 2))] = true;
                this.add_glyph(first);
                this.add_glyph(second);
                return this;
        }
    }

    private add_block_glyph(letter: string) : {glyph: BlockGlyph, position: Pos2d} {
        let translate_pos : Pos2d = this.pos_func(this.index);
        if(this.occupied[pos2dToString(translate_pos)]) {
            throw new Error(`Glyph collision! (at: x=${translate_pos[0]}, y=${translate_pos[1]})`);
        }
        this.occupied[pos2dToString(translate_pos)] = true;
        translate_pos = [translate_pos[0] * 11 + this.start_pos[0], translate_pos[1] * 11 + this.start_pos[1]];

        let glyph = GlyphBuilder.parse_result.block_glyphs[letter].translate(pos => [pos[0] + translate_pos[0], pos[1] + translate_pos[1]]);
        this.glyphs.push(glyph);
        this.index++;
        return { glyph, position: translate_pos };
    }

    private add_decal_glyphs(letters: string[], position: Pos2d, func: (pos: Pos2d) => Pos2d) : void {
        let height = 1, decal_glyph: DecalGlyph;
        for(var i = 0; i < letters.length; ++i) {
            if(i == letters.length - 1 && letters[i] == letters[i-1]) {
                decal_glyph = GlyphBuilder.parse_result.decal_glyphs["ditto"];
            }
            else {
                decal_glyph = GlyphBuilder.parse_result.decal_glyphs[letters[i]];
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

    private add_glyph(letters: string[]) : void {
        if(letters.length != 0) {
            let { glyph, position } = this.add_block_glyph(letters[0]);
            let { block_glyphs, decal_glyphs } = GlyphBuilder.parse_result;

            if(letters.length != 1) {
                let i = 1, rect = glyph.child_rect;

                for(; i < this.child_depth+1; ++i) {
                    if(i >= letters.length) break;
                    let child_glyph = block_glyphs[letters[i]].fit_to_rect(rect);
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
                        throw new Error(`No space to put the decal at! (at: x=${position[0]}, y=${position[1]})`)
                    }
                    if(letters[i] == decals[j % 4][decals[j % 4].length - 1]) {
                        decal_glyph = GlyphBuilder.parse_result.decal_glyphs["ditto"];
                    }
                    else {
                        decal_glyph = GlyphBuilder.parse_result.decal_glyphs[letters[i]];
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
                    this.add_decal_glyphs(decals[i], position, funcs[i]);
                }
            }
        }
    }

    to_svg_element(document: XMLDocument) : SVGSVGElement {
        let min : Pos2d = [0, 0], max: Pos2d = [0, 0];
        for(const glyph of this.glyphs) {
            if(glyph.rect.x < min[0]) min[0] = glyph.rect.x;
            if(glyph.rect.y < min[1]) min[1] = glyph.rect.y;
            if(glyph.rect.x + glyph.rect.w > max[0]) max[0] = glyph.rect.x + glyph.rect.w;
            if(glyph.rect.y + glyph.rect.h > max[1]) max[1] = glyph.rect.y + glyph.rect.h;
        }
        let bbox : Rect = { x: min[0], y: min[1], w: max[0] - min[0], h: max[1] - min[1] };

        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", this.scale * bbox.w + "");
        svg.setAttribute("height", this.scale * bbox.h + "")
        for(const glyph of this.glyphs) {
            let glyph1 = glyph.translate(pos => [this.scale * (pos[0] - min[0]), this.scale * (pos[1] - min[1])]);
            for(const polygon of glyph1.to_svg_polygon(document, { fill: this.fill })) {
                svg.appendChild(polygon);
            }
        }
        return svg;
    }

    static parseGlyphJson() : GlyphJsonParseResult {
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
                { x: glyphJson.child_pos[0], y: glyphJson.child_pos[1], w: 4, h: 4 }
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
                glyphJson.height
            );
        }
    
        return result;
    }

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



(function() {

    const program = new Command();

    program
        .requiredOption('-t, --text <text>', 'text to parse')
        .option('-d, --depth <number>', 'child block glyph depth', '1')
        .option('-s, --scale <number>', 'scale', '1')
        .option('-c, --color <color>', 'color value to color the glyphs', '#000000')
        .parse();

    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
    let svg = new GlyphBuilder({
        child_depth: program.opts().depth - 0, allow_special_glyphs: false, scale: program.opts().scale - 0, custom_pos_func: index => [index, 0]
    }).add_sentence(program.opts().text).to_svg_element(document);
    
    fs.writeFileSync('result.svg', new XMLSerializer().serializeToString(svg));
    console.log("Exported to result.svg")
})()