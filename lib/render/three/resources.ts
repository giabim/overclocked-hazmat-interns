export class Resources{
  private items=new Set<{dispose():void}>();
  own<T extends {dispose():void}>(item:T):T{this.items.add(item);return item;}
  release(item:{dispose():void}){if(this.items.delete(item))item.dispose();}
  dispose(){for(const item of this.items)item.dispose();this.items.clear();}
}
