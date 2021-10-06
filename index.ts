import * as fs from 'fs';
import * as glyphdata from './glyph.json';
import { DOMImplementation, XMLSerializer } from 'xmldom';



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
    let new_lt : Pos2d = func([rect.x, rect.y]);
    let new_rb : Pos2d = func([rect.x + rect.w, rect.y + rect.h]);
    return { x: new_lt[0], y: new_lt[1], w: new_rb[0] - new_lt[0], h: new_rb[1] - new_lt[1] };
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
    small_glyphs: boolean;
    pos_func: (index: number) => Pos2d;

    constructor({start_pos, allow_special_glyphs = true, allow_small_glyphs = true, custom_pos_func = index => [index, 0]}: {
        start_pos: Pos2d
        allow_special_glyphs?: boolean,
        allow_small_glyphs?: boolean,
        custom_pos_func?: (index: number) => Pos2d
    }) {
        this.start_pos = start_pos;
        this.glyphs = [];
        this.index = 0;
        this.special_glyphs = allow_special_glyphs;
        this.small_glyphs = allow_small_glyphs;
        this.pos_func = custom_pos_func;
    }

    add_sentence(sentence: string) : GlyphBuilder {
        let word = "", char: string;
        for(var i = 0; i < sentence.length; ++i) {
            char = sentence.charAt(i).toLocaleLowerCase();
            switch(char) {
                case ' ':
                    this.add_word(word);
                    word = "";
                    break;
                case ':':
                    this.add_word(word);
                    this.add_block_glyph(":");
                    word = "";
                    break;
                case '.':
                    this.add_word(word);
                    this.add_block_glyph(".");
                    word = "";
                    break;
                default:
                    word += char;
            }
        }
        return this;
    }

    add_word(word: string) : GlyphBuilder {

        switch(word) {
            case 'the':
            case 'that':
            case 'they':
                if(this.special_glyphs) {
                    this.add_block_glyph("the");
                    break;
                }
            case 'i':
                if(this.special_glyphs) {
                    this.add_block_glyph("first_person");
                    break;
                }
            default:
                let first : string[] = [], second : string[] = [];
                for(var i = 0; i < word.length; ++i) {
                    let char = word.charAt(i).toLocaleLowerCase();
                    if(GlyphBuilder.vowels.includes(char)) second.push(char);
                    else {
                        if(char == 'j') {
                            first.push('d', 'z');
                        }
                        else {
                            first.push(char);
                        }
                    }
                }
                this.add_glyph(first);
                this.add_glyph(second);
                return this;
        }
    }

    private add_block_glyph(letter: string) : {glyph: BlockGlyph, position: Pos2d} {
        let translate_pos : Pos2d = this.pos_func(this.index);
        translate_pos = [translate_pos[0] * 11 + this.start_pos[0], translate_pos[1] * 11 + this.start_pos[1]];

        let glyph = GlyphBuilder.parse_result.block_glyphs[letter].translate(pos => [pos[0] + translate_pos[0], pos[1] + translate_pos[1]]);
        this.glyphs.push(glyph);
        this.index++;
        return { glyph, position: translate_pos };
    }

    private add_glyph(letters: string[]) : void {
        let { block_glyphs, decal_glyphs } = GlyphBuilder.parse_result;

        if(letters.length != 0) {
            let { glyph, position } = this.add_block_glyph(letters[0]);
    
            if(letters.length != 1) {
                let i: number;

                if(this.small_glyphs) {
                    let child_glyph = block_glyphs[letters[1]].fit_to_rect(glyph.child_rect);
                    this.glyphs.push(child_glyph);
                    i = 2;
                }
                else {
                    i = 1;
                }
        
                let top: string[] = [], bottom: string[] = [], decal_glyph: DecalGlyph;
                for(; i < letters.length; ++i) {
                    if(i % 2 == 0) {
                        top.push(letters[i]);
                    }
                    else {
                        bottom.push(letters[i]);
                    }
                }
        
                let height = 1;
                for(i = 0; i < top.length; ++i) {
                    if(i == top.length - 1 && top[i] == top[i-1]) {
                        decal_glyph = decal_glyphs["ditto"];
                    }
                    else {
                        decal_glyph = decal_glyphs[top[i]];
                    }
                    this.glyphs.push(decal_glyph.translate(pos => [pos[0] + position[0], pos[1] + position[1] - height]));
                    height += decal_glyph.height + 1;
                }
        
                height = 1;
                for(i = 0; i < bottom.length; ++i) {
                    if(i == bottom.length - 1 && bottom[i] == bottom[i-1]) {
                        decal_glyph = decal_glyphs["ditto"];
                    }
                    else {
                        decal_glyph = decal_glyphs[bottom[i]];
                    }
                    this.glyphs.push(decal_glyph.translate(pos => [-pos[0] + 10 + position[0], -pos[1] + 10 + position[1] + height]));
                    height += decal_glyph.height + 1;
                }
            }
        }
    }

    to_svg_element(document: XMLDocument) : SVGSVGElement {
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        for(const glyph of this.glyphs) {
            for(const polygon of glyph.to_svg_polygon(document, { fill: "#000000" })) {
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
                { x: 0, y: 0, w: 10, h: glyphJson.height },
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

    const sentence = "What the fuck did you just fucking say about me you little bitch." + 
    "I will have you know I graduated top of my class in the Navy Seals and I have been involved in numerous secret raids on AlQuaeda " + 
    "and I have over three hundred confirmed kills. I am trained in gorilla warfare and I am the top sniper in the entire US armed forces. You are " + 
    "nothing to me but just another target. I will wipe you the fuck out with precision the likes of which has never been seen before on " + 
    "this Earth mark my fucking words. You think you can get away with saying that shit to me over the Internet. Think again fucker. " + 
    "As we speak I am contacting my secret network of spies across the USA and your IP is being traced right now so you better prepare for " + 
    "the storm maggot. The storm that wipes out the pathetic little thing you call your life. You are fucking dead kid. I can be anywhere " + 
    "anytime and I can kill you in over seven hundred ways and that is just with my bare hands. Not only am I extensively trained in unarmed " + 
    "combat but I have access to the entire arsenal of the United States Marine Corps and I will use it to its full extent to wipe your " + 
    "miserable ass off the face of the continent you little shit. If only you could have known what unholy retribution your little clever " + 
    "comment was about to bring down upon you maybe you would have held your fucking tongue. But you could not you did not and now you are " + 
    "paying the price you goddamn idiot. I will shit fury all over you and you will drown in it. You are fucking dead kiddo.";

    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
    let svg = new GlyphBuilder({
        start_pos: [20, 20], allow_small_glyphs: false, allow_special_glyphs: false
    }).add_sentence(sentence).to_svg_element(document);
    
    fs.writeFileSync('examples/test.svg', new XMLSerializer().serializeToString(svg));
})()