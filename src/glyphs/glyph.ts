import { Polygon, Rectangle, Pos2d, transformRectangle } from '../shapes';

export class Glyph {

    readonly shape: Polygon[];
    readonly rect: Rectangle;
    readonly class_name: string;

    constructor(shape: Polygon[], rect: Rectangle, name: string) {
        this.shape = shape;
        this.rect = rect;
        this.class_name = name;
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
        return new Glyph(new_shape, transformRectangle(this.rect, func), this.class_name);
    }

    fitToRectangle(rect: Rectangle) : Glyph {
        return this.translate(pos => [pos[0] * (rect.w / this.rect.w) + rect.x, pos[1] * (rect.h / this.rect.h) + rect.y]);
    }

    toSVGGroupElement(xmlDoc: XMLDocument, polygon_attrs: { [key: string]: string } ) : SVGGElement {
        
        let result : SVGGElement = xmlDoc.createElementNS("http://www.w3.org/2000/svg", "g");
        result.setAttribute("class", this.class_name);

        for(const polygon of this.shape) {
            let element = xmlDoc.createElementNS("http://www.w3.org/2000/svg", "polygon");
            let points = `${polygon[0][0]},${polygon[0][1]}`;
            for(var i = 1; i < polygon.length; ++i) {
                points += ` ${polygon[i][0]},${polygon[i][1]}`;
            }
            element.setAttribute("points", points);
            for(const key of Object.keys(polygon_attrs)) {
                element.setAttribute(key, polygon_attrs[key]);
            }
            result.appendChild(element);
        }

        return result;
    }
}