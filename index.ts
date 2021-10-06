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



class DecalGlyph extends Glyph {}



class GlyphBuilder {
    
    glyphs: Glyph[];
    position: Pos2d

    constructor(position: Pos2d = [0, 0]) {
        this.position = position;
        this.glyphs = [];
    }

    addWord() {

    }

}



function pointStringToPolygon(points: string) : Polygon {
    const pointArray = points.split(' ');
    let polygon : Polygon = [];

    for(const pointString of pointArray) {
        let point = pointString.split(',');
        polygon.push([Number.parseInt(point[0]), Number.parseInt(point[1])]);
    }

    return polygon;
}



function parseGlyphJson() : GlyphJsonParseResult {
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
            { x: 0, y: 0, w: 10, h: 10 }
        );
    }

    return result;
}



(function() {
    let { block_glyphs, decal_glyphs } = parseGlyphJson();
    let glyphs : Glyph[] = [];
    
    const alphabets = "abcdefghijklmnopqrstuvwxyz";
    let a: string, b: string;
    for(var i = 0; i < alphabets.length; ++i) {
        a = alphabets.charAt(i);
        if(block_glyphs[a]) {
            let glyph = block_glyphs[a];
            let glyph1 = glyph.translate(pos => [(pos[0] + (12 * i)) * 5 + 10, pos[1] * 5 + 50]);
            glyphs.push(glyph1);
    
            b = alphabets.charAt(i+1 >= alphabets.length ? 0 : i+1);
            if(block_glyphs[b]) {
                glyphs.push(block_glyphs[b].fit_to_rect(glyph1.child_rect));
            }
        }
        if(decal_glyphs[a]) {
            let glyph = decal_glyphs[a].translate(pos => [(pos[0] + (12 * i)) * 5 + 10, (pos[1] - 1) * 5 + 50]);
            glyphs.push(glyph);
        }
    }
    
    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for(const glyph of glyphs) {
        for(const polygon of glyph.to_svg_polygon(document, { fill: "#000000" })) {
            svg.appendChild(polygon);
        }
    }
    
    fs.writeFileSync('examples/test.svg', new XMLSerializer().serializeToString(svg));
})()