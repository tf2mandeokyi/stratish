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

    polygons: Polygon[];
    rect: Rect;

    constructor(polygons: Polygon[], rect: Rect) {
        this.polygons = polygons;
        this.rect = rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : Glyph {
        let new_polygons : Polygon[] = [];
        for(const polygon of this.polygons) {
            let new_polygon : Polygon = [];
            for(const point of polygon) {
                new_polygon.push(func(point));
            }
            new_polygons.push(new_polygon);
        }
        return new Glyph(new_polygons, transform_rect(this.rect, func));
    }

    fit_to_rect(rect: Rect) : Glyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

    to_svg_polygon(xmlDoc: XMLDocument, args: {fill: string}) : SVGPolygonElement[] {
        let result : SVGPolygonElement[] = [];

        for(const polygon of this.polygons) {
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

    constructor(polygons: Polygon[], rect: Rect, child_rect: Rect) {
        super(polygons, rect);
        this.child_rect = child_rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : BlockGlyph {
        let glyph_result = super.translate(func);
        return new BlockGlyph(glyph_result.polygons, glyph_result.rect, transform_rect(this.child_rect, func));
    }

    fit_to_rect(rect: Rect) : BlockGlyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

}



class DecalGlyph extends Glyph {

    height: number;

    constructor(polygons: Polygon[], rect: Rect, height: number) {
        super(polygons, rect);
        this.height = height;
    }

    translate(func: (pos: Pos2d) => Pos2d) : DecalGlyph {
        let glyph_result = super.translate(func);
        return new DecalGlyph(glyph_result.polygons, glyph_result.rect, this.height);
    }

}



class GlyphBuilder {

    static vowels = "aeiouy";
    static parse_result = GlyphBuilder.parseGlyphJson();

    glyphs: Glyph[];
    position: Pos2d

    constructor(position: Pos2d = [0, 0]) {
        this.position = position;
        this.glyphs = [];
    }

    reset(position: Pos2d = [0, 0]) : GlyphBuilder {
        this.position = position;
        this.glyphs = [];
        return this;
    }

    add_sentence(sentence: string) : GlyphBuilder {
        let word = "", char: string;
        for(var i = 0; i < sentence.length; ++i) {
            char = sentence.charAt(i);
            switch(char) {
                case ' ':
                    this.add_word(word);
                    word = "";
                    break;
                case ',':
                    this.add_word(word);
                    this.add_block_glyph(",");
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
        let first : string[] = [], second : string[] = [];
        for(var i = 0; i < word.length; ++i) {
            let char = word.charAt(i).toLocaleLowerCase();
            if(GlyphBuilder.vowels.includes(char)) second.push(char);
            else first.push(char);
        }
        this.add_glyph(first);
        this.add_glyph(second);
        return this;
    }

    private add_block_glyph(letter: string) : {glyph: BlockGlyph, position: Pos2d} {
        let glyph = GlyphBuilder.parse_result.block_glyphs[letter].translate(pos => [pos[0] + this.position[0] * 11, pos[1] + this.position[1] * 11]);
        let position : Pos2d = [this.position[0], this.position[1]];
        this.glyphs.push(glyph);
        this.position[0]++;
        return { glyph, position };
    }

    private add_glyph(letters: string[]) : void {
        let { block_glyphs, decal_glyphs } = GlyphBuilder.parse_result;

        if(letters.length != 0) {
            let { glyph, position } = this.add_block_glyph(letters[0]);
    
            if(letters.length != 1) {
                let child_glyph = block_glyphs[letters[1]].fit_to_rect(glyph.child_rect);
                this.glyphs.push(child_glyph);
        
                let top = [], bottom = [];
                for(var i = 2; i < letters.length; ++i) {
                    if(i % 2 == 0) {
                        top.push(letters[i]);
                    }
                    else {
                        bottom.push(letters[i]);
                    }
                }
        
                let height = 1;
                for(var i = 0; i < top.length; ++i) {
                    let glyph : DecalGlyph;
                    if(i == top.length - 1 && top[i] == top[i-1]) {
                        glyph = decal_glyphs["ditto"];
                    }
                    else {
                        glyph = decal_glyphs[top[i]];
                    }
                    this.glyphs.push(glyph.translate(pos => [pos[0] + position[0] * 11, pos[1] + position[1] * 11 - height]));
                    height += glyph.height + 1;
                }
        
                height = 1;
                for(var i = 0; i < bottom.length; ++i) {
                    let glyph : DecalGlyph;
                    if(i == bottom.length - 1 && bottom[i] == bottom[i-1]) {
                        glyph = decal_glyphs["ditto"];
                    }
                    else {
                        glyph = decal_glyphs[bottom[i]];
                    }
                    this.glyphs.push(glyph.translate(pos => [-pos[0] + 10 + position[0] * 11, -pos[1] + 10 + position[1] * 11 + height]));
                    height += glyph.height + 1;
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
            let polygons : Polygon[] = [];
    
            for(const polygonString of glyphJson.polygons) {
                polygons.push(pointStringToPolygon(polygonString));
            }
    
            result.block_glyphs[alphabet] = new BlockGlyph(
                polygons, 
                { x: 0, y: 0, w: 10, h: 10 },
                { x: glyphJson.child_pos[0], y: glyphJson.child_pos[1], w: 4, h: 4 }
            );
        }
    
        for(const alphabet of Object.keys(glyphdata.decal_glyphs)) {
            const glyphJson = glyphdata.decal_glyphs[alphabet];
            let polygons : Polygon[] = [];
    
            for(const polygonString of glyphJson.polygons) {
                polygons.push(pointStringToPolygon(polygonString));
            }
    
            result.decal_glyphs[alphabet] = new DecalGlyph(
                polygons, 
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

    const sentence = "Thisss is rude.";

    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
    let svg = new GlyphBuilder([1, 4]).add_sentence(sentence).to_svg_element(document);
    
    fs.writeFileSync('examples/test.svg', new XMLSerializer().serializeToString(svg));
})()