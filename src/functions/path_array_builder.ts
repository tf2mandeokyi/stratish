import { Pos2d } from '../shapes';

export abstract class Action {
    abstract apply(parent: PathPosArrayBuilder);
}

export abstract class PositionAction extends Action {
    protected readonly position: Pos2d;
    constructor(new_direction: Pos2d) {
        super();
        this.position = new_direction;
    }
}

export class ChangeDirection extends PositionAction {
    constructor(new_direction: Pos2d) {
        super(new_direction);
    }
    apply(parent: PathPosArrayBuilder) {
        parent.direction = this.position;
    }
}

export class ChangePosition extends PositionAction {
    constructor(new_direction: Pos2d) {
        super(new_direction);
    }
    apply(parent: PathPosArrayBuilder) {
        parent.position = this.position;
    }
}

export class PathPosArrayBuilder {

    private actions: { [x: number]: Action[] };
    direction: Pos2d;
    position: Pos2d;
    private array: Pos2d[];

    constructor(actions: { [x: number]: Action[] }) {
        this.direction = [1, 0];
        this.position = [0, 0];
        this.actions = actions;
        this.array = [];
    }

    addAction(index: number, action: Action) {
        if(this.actions[index]) {
            this.actions[index].push(action);
        }
        else {
            this.actions[index] = [action];
        }
    }

    get(index: number) : Pos2d {
        if(index < this.array.length) {
            return this.array[index];
        }
        for(var i = this.array.length; i <= index; ++i) {
            if(this.actions[i]) {
                for(const action of this.actions[i]) {
                    action.apply(this);
                }
            }
            this.array.push(this.position);
            this.position = [this.position[0] + this.direction[0], this.position[1] + this.direction[1]];
        }
        return this.array[index];
    }

}