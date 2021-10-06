import * as fs from 'fs';
import * as glyphdata from './sbglyph.json';
import { DOMImplementation, XMLSerializer } from 'xmldom';



type Pos2d = [number, number];
type Polygon = Pos2d[];
interface Rect {
    x: number, y: number, w: number, h: number;
}

interface GlyphJsonParseResult {
    primary_glyphs: { [alphabet: string] : PrimaryGlyph }
}



function transform_rect(rect: Rect, func: (pos: Pos2d) => Pos2d) : Rect {
    let new_lt : Pos2d = func([rect.x, rect.y]);
    let new_rb : Pos2d = func([rect.x + rect.w, rect.y + rect.h]);
    return { x: new_lt[0], y: new_lt[1], w: new_rb[0] - new_lt[0], h: new_rb[1] - new_lt[1] };
}



class PrimaryGlyph {

    polygons: Polygon[];
    rect: Rect;
    child_rect: Rect;

    constructor(polygons: Polygon[], rect: Rect, child_rect: Rect) {
        this.polygons = polygons;
        this.rect = rect;
        this.child_rect = child_rect;
    }

    translate(func: (pos: Pos2d) => Pos2d) : PrimaryGlyph {
        let new_polygons : Polygon[] = [];
        for(const polygon of this.polygons) {
            let new_polygon : Polygon = [];
            for(const point of polygon) {
                new_polygon.push(func(point));
            }
            new_polygons.push(new_polygon);
        }
        return new PrimaryGlyph(new_polygons, transform_rect(this.rect, func), transform_rect(this.child_rect, func));
    }

    fit_to_rect(rect: Rect) : PrimaryGlyph {
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



function parseGlyphJson() : GlyphJsonParseResult {
    let result : GlyphJsonParseResult = { primary_glyphs: {} };

    for(const alphabet of Object.keys(glyphdata.primary_glyphs)) {
        const glyphJson = glyphdata.primary_glyphs[alphabet];
        let polygons : Polygon[] = [];

        for(const polygonString of glyphJson.polygons) {
            const pointArray = polygonString.split(' ');
            let polygon : Polygon = [];

            for(const pointString of pointArray) {
                let point = pointString.split(',');
                polygon.push([Number.parseInt(point[0]), Number.parseInt(point[1])]);
            }

            polygons.push(polygon);
        }

        result.primary_glyphs[alphabet] = new PrimaryGlyph(
            polygons, 
            { x: 0, y: 0, w: 10, h: 10 },
            { x: glyphJson.child_pos[0], y: glyphJson.child_pos[1], w: 4, h: 4 }
        );
    }

    return result;
}



let { primary_glyphs } = parseGlyphJson();
let glyphs : PrimaryGlyph[] = [];

const alphabets = "abcdefghijklmnopqrstuvwxyz";
let a: string, b: string;
for(var i = 0; i < alphabets.length; ++i) {
    a = alphabets.charAt(i);
    if(primary_glyphs[a]) {
        let glyph = primary_glyphs[a];
        let glyph1 = glyph.translate(pos => [(pos[0] + (12 * i)) * 5, pos[1] * 5]);
        glyphs.push(glyph1);

        b = alphabets.charAt(i+1 >= alphabets.length ? 0 : i+1);
        if(primary_glyphs[b]) {
            glyphs.push(primary_glyphs[b].fit_to_rect(glyph1.child_rect));
        }
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